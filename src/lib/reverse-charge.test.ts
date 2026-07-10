import { describe, it, expect } from "vitest";
import {
  reverseChargeVatCents,
  isReverseChargeRelevant,
  aggregateReverseCharge,
  aggregateReverseChargeByQuarter,
  quarterOf,
  type RcVoucher,
} from "./reverse-charge";

describe("reverse-charge", () => {
  it("USt-Berechnung 19 %", () => {
    expect(reverseChargeVatCents(4818, 19)).toBe(915); // 48,18 → 9,15
    expect(reverseChargeVatCents(6250, 19)).toBe(1188); // 62,50 → 11,88 (kaufm. gerundet)
  });

  it("nur `ja` ist relevant, `pruefen` zählt nicht", () => {
    expect(isReverseChargeRelevant("ja")).toBe(true);
    expect(isReverseChargeRelevant("nein")).toBe(false);
    expect(isReverseChargeRelevant("pruefen")).toBe(false);
  });

  it("Aggregation über die Reverse-Charge-Q2-Liste", () => {
    const d = new Date(Date.UTC(2026, 4, 1)); // Mai 2026 → Q2
    const vouchers: RcVoucher[] = [
      { reverseCharge: "ja", reverseChargeBaseEurCents: 6250, reverseChargeVatRate: 19, date: d }, // Cortecs
      { reverseCharge: "ja", reverseChargeBaseEurCents: 2430, reverseChargeVatRate: 19, date: d }, // Google Cloud
      { reverseCharge: "ja", reverseChargeBaseEurCents: 4818, reverseChargeVatRate: 19, date: d }, // Unipile
      { reverseCharge: "pruefen", reverseChargeBaseEurCents: 9999, reverseChargeVatRate: 19, date: d }, // zählt NICHT
      { reverseCharge: "ja", reverseChargeBaseEurCents: null, reverseChargeVatRate: 19, date: d }, // ohne Basis → NICHT
    ];
    const agg = aggregateReverseCharge(vouchers);
    expect(agg.count).toBe(3);
    expect(agg.baseCents).toBe(13498); // 62,50 + 24,30 + 48,18
    expect(agg.vatCents).toBe(1188 + 462 + 915);
  });

  it("Quartal-Zuordnung", () => {
    expect(quarterOf(new Date(Date.UTC(2026, 3, 15)))).toBe("2026-Q2");
    expect(quarterOf(new Date(Date.UTC(2026, 6, 1)))).toBe("2026-Q3");
    const byQ = aggregateReverseChargeByQuarter([
      { reverseCharge: "ja", reverseChargeBaseEurCents: 1000, reverseChargeVatRate: 19, date: new Date(Date.UTC(2026, 1, 1)) },
      { reverseCharge: "ja", reverseChargeBaseEurCents: 2000, reverseChargeVatRate: 19, date: new Date(Date.UTC(2026, 7, 1)) },
    ]);
    expect(byQ["2026-Q1"].baseCents).toBe(1000);
    expect(byQ["2026-Q3"].baseCents).toBe(2000);
  });
});
