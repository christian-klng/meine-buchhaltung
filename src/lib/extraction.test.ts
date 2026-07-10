import { describe, it, expect } from "vitest";
import { detectCurrency, extractAmountCents, extractDate, extractVoucherNumber, extractFields, matchVendor } from "./extraction";

const TELEKOM = `Telekom Deutschland GmbH
Rechnung
Rechnungsnummer: 7646598285
Rechnungsdatum: 13.03.2026
Mobilfunk 21,85
Zwischensumme 21,85
Gesamtbetrag 26,00 €
Fällig 31.03.2026`;

const UNIPILE = `UNIPILE
Invoice number: INV-2026-0042
Date: 2026-05-10
Subtotal: $48.18
Total due: $48.18 USD`;

describe("extraction — Währung", () => {
  it("erkennt USD und EUR", () => {
    expect(detectCurrency("Total due: $48.18 USD")).toBe("USD");
    expect(detectCurrency("Gesamtbetrag 26,00 €")).toBe("EUR");
    expect(detectCurrency("Betrag 100,00")).toBe("EUR"); // Default
  });
});

describe("extraction — Betrag", () => {
  it("nimmt den Summen-Betrag, nicht die Zwischensumme, und verwechselt kein Datum", () => {
    expect(extractAmountCents(TELEKOM)).toBe(2600);
  });
  it("maskiert Datumsangaben aus (31.12.2026 ist kein Betrag)", () => {
    expect(extractAmountCents("Leistung am 31.12.2026, Gesamt 9,99 €")).toBe(999);
  });
  it("englische Rechnung", () => {
    expect(extractAmountCents(UNIPILE)).toBe(4818);
  });
  it("gibt null ohne Betrag", () => {
    expect(extractAmountCents("kein betrag hier")).toBeNull();
  });
});

describe("extraction — Datum", () => {
  it("bevorzugt das beschriftete Rechnungsdatum", () => {
    expect(extractDate(TELEKOM)?.toISOString().slice(0, 10)).toBe("2026-03-13");
  });
  it("ISO-Datum", () => {
    expect(extractDate(UNIPILE)?.toISOString().slice(0, 10)).toBe("2026-05-10");
  });
});

describe("extraction — Belegnummer", () => {
  it("liest die Rechnungsnummer", () => {
    expect(extractVoucherNumber(TELEKOM)).toBe("7646598285");
    expect(extractVoucherNumber(UNIPILE)).toBe("INV-2026-0042");
  });
});

describe("extraction — Gesamt & Lieferant", () => {
  it("extractFields liefert konsistentes Ergebnis", () => {
    const f = extractFields(TELEKOM);
    expect(f).toMatchObject({ currency: "EUR", amountCents: 2600, voucherNumber: "7646598285", hasText: true });
    expect(f.date?.toISOString().slice(0, 10)).toBe("2026-03-13");
  });

  it("matchVendor findet den Lieferanten über matchStrings", () => {
    const vendors = [
      { contactId: "c1", name: "Telekom Deutschland GmbH", matchStrings: ["telekom"], matchDomains: ["telekom.de"] },
      { contactId: "c2", name: "Maingau Energie GmbH", matchStrings: ["maingau"], matchDomains: [] },
    ];
    expect(matchVendor(TELEKOM, vendors)?.contactId).toBe("c1");
    expect(matchVendor("nichts passendes", vendors)).toBeNull();
  });
});
