import { describe, it, expect } from "vitest";
import {
  normalizeName,
  nameSimilarity,
  matchCandidates,
  findDuplicates,
  reconcile,
  daysBetween,
  type VoucherLike,
  type TxLike,
} from "./reconciliation";

const d = (iso: string) => new Date(iso);

describe("reconciliation — Namen", () => {
  it("normalisiert Rechtsformen weg", () => {
    expect(normalizeName("Telekom Deutschland GmbH")).toBe("telekom deutschland");
  });
  it("Ähnlichkeit erkennt denselben Anbieter", () => {
    expect(nameSimilarity("Telekom Deutschland GmbH", "TELEKOM DEUTSCHLAND")).toBeGreaterThanOrEqual(0.8);
    expect(nameSimilarity("St. Oberholz Coffee GmbH", "OBERHOLZ COFFEE")).toBeGreaterThanOrEqual(0.4);
    expect(nameSimilarity("Telekom", "Maingau Energie")).toBeLessThan(0.4);
  });
});

describe("reconciliation — Matching", () => {
  const txs: TxLike[] = [
    { id: "t1", date: d("2026-03-15"), amountCents: -2600, counterparty: "Telekom Deutschland GmbH" },
    { id: "t2", date: d("2026-03-14"), amountCents: -1800, counterparty: "St. Oberholz" },
    { id: "t3", date: d("2026-03-10"), amountCents: -2799, counterparty: "Unipile" },
  ];

  it("EUR-Beleg matcht über Betrag + Datum", () => {
    const v: VoucherLike = { id: "v1", date: d("2026-03-13"), amountCents: 2600, currency: "EUR", status: "unchecked", counterparty: "Telekom" };
    const cands = matchCandidates(v, txs, { dateWindowDays: 5 });
    expect(cands[0].transactionId).toBe("t1");
    expect(cands[0].confidence).toBeGreaterThanOrEqual(70);
  });

  it("außerhalb des Datumsfensters kein Match", () => {
    const v: VoucherLike = { id: "v1", date: d("2026-01-01"), amountCents: 2600, currency: "EUR", status: "unchecked", counterparty: "Telekom" };
    expect(matchCandidates(v, txs, { dateWindowDays: 5 })).toHaveLength(0);
  });

  it("Fremdwährungsbeleg matcht OHNE Betrag (nur Gegenpartei + Datum)", () => {
    // Belegbetrag ist der falsche 1:1-USD-Wert (2999), Bank zeigt 2799 — trotzdem Match über Unipile+Datum
    const v: VoucherLike = { id: "v9", date: d("2026-03-11"), amountCents: 2999, currency: "USD", status: "awaiting_fx", counterparty: "Unipile" };
    const cands = matchCandidates(v, txs, { dateWindowDays: 5 });
    expect(cands[0].transactionId).toBe("t3");
    expect(cands[0].reason).toContain("Fremdwährung");
  });
});

describe("reconciliation — Duplikate & Gesamtabgleich", () => {
  it("Duplikate über voucherNumber + Betrag", () => {
    const vs: VoucherLike[] = [
      { id: "a", date: d("2026-03-01"), amountCents: 1800, currency: "EUR", status: "unchecked", voucherNumber: "RE-1" },
      { id: "b", date: d("2026-03-01"), amountCents: 1800, currency: "EUR", status: "unchecked", voucherNumber: "re-1" },
      { id: "c", date: d("2026-03-01"), amountCents: 1800, currency: "EUR", status: "unchecked", voucherNumber: "RE-2" },
    ];
    const dups = findDuplicates(vs);
    expect(dups).toHaveLength(1);
    expect(dups[0].voucherIds.sort()).toEqual(["a", "b"]);
  });

  it("gleicher Betrag bei verschiedenen Nummern ist KEIN Duplikat", () => {
    const vs: VoucherLike[] = [
      { id: "a", date: d("2026-03-01"), amountCents: 1800, currency: "EUR", status: "unchecked", voucherNumber: "RE-1" },
      { id: "b", date: d("2026-04-01"), amountCents: 1800, currency: "EUR", status: "unchecked", voucherNumber: "RE-2" },
    ];
    expect(findDuplicates(vs)).toHaveLength(0);
  });

  it("reconcile: privat bezahlte Belege stehen nicht in 'ohne Buchung'", () => {
    const vs: VoucherLike[] = [
      { id: "v1", date: d("2026-03-13"), amountCents: 2600, currency: "EUR", status: "unchecked", counterparty: "Telekom" },
      { id: "v2", date: d("2026-03-13"), amountCents: 500, currency: "EUR", status: "unchecked", counterparty: "Bar", paidPrivately: true },
    ];
    const txs: TxLike[] = [{ id: "t1", date: d("2026-03-15"), amountCents: -2600, counterparty: "Telekom Deutschland GmbH" }];
    const res = reconcile(vs, txs, { dateWindowDays: 5 });
    expect(res.matches.some((m) => m.voucherId === "v1" && m.transactionId === "t1")).toBe(true);
    expect(res.vouchersWithoutTx).not.toContain("v2");
    expect(res.vouchersWithoutTx).not.toContain("v1");
  });

  it("daysBetween ist symmetrisch", () => {
    expect(daysBetween(d("2026-03-01"), d("2026-03-06"))).toBe(5);
    expect(daysBetween(d("2026-03-06"), d("2026-03-01"))).toBe(5);
  });
});
