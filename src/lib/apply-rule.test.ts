import { describe, it, expect } from "vitest";
import { buildProposal, type RuleInput, type ExtractInput } from "./apply-rule";

const telekomRule: RuleInput = {
  contactId: "telekom",
  defaultCategoryId: null,
  splitType: "split_70_30",
  businessPercent: 70,
  businessCategoryId: "mobil",
  privatCategoryId: "privat",
  currency: "EUR",
  reverseCharge: "nein",
  reverseChargeVatRate: 19,
};

const cortecsRule: RuleInput = {
  contactId: "cortecs",
  defaultCategoryId: "saas",
  splitType: "none",
  businessPercent: null,
  businessCategoryId: null,
  privatCategoryId: null,
  currency: "EUR",
  reverseCharge: "ja",
  reverseChargeVatRate: 19,
};

const unipileRule: RuleInput = {
  contactId: "unipile",
  defaultCategoryId: "saas",
  splitType: "none",
  businessPercent: null,
  businessCategoryId: null,
  privatCategoryId: null,
  currency: "USD",
  reverseCharge: "ja",
  reverseChargeVatRate: 19,
};

const ex = (amountCents: number | null, currency = "EUR"): ExtractInput => ({ amountCents, currency, date: null, voucherNumber: null });

describe("buildProposal", () => {
  it("Telekom-Split: zwei Positionen 70/30, unchecked, kein § 13b", () => {
    const p = buildProposal(telekomRule, ex(2600));
    expect(p.status).toBe("unchecked");
    expect(p.items).toEqual([
      { categoryId: "mobil", amountCents: 1820, note: "Betrieb" },
      { categoryId: "privat", amountCents: 780, note: "Privatentnahme" },
    ]);
    expect(p.taxType).toBe("vatfree");
    expect(p.reverseChargeBaseEurCents).toBeNull();
  });

  it("Cortecs (EUR, § 13b): eine Position, Basis + USt gesetzt", () => {
    const p = buildProposal(cortecsRule, ex(6250));
    expect(p.status).toBe("unchecked");
    expect(p.items).toEqual([{ categoryId: "saas", amountCents: 6250 }]);
    expect(p.taxType).toBe("reverse_charge");
    expect(p.reverseChargeBaseEurCents).toBe(6250);
    expect(p.reverseChargeVatCents).toBe(1188);
    expect(p.reverseChargeVatRate).toBe(19);
  });

  it("Unipile (USD, § 13b): awaiting_fx, KEINE Positionen, § 13b-Basis deferred", () => {
    const p = buildProposal(unipileRule, ex(4818, "USD"));
    expect(p.status).toBe("awaiting_fx");
    expect(p.currency).toBe("USD");
    expect(p.items).toEqual([]);
    expect(p.reverseCharge).toBe("ja");
    expect(p.taxType).toBe("reverse_charge");
    expect(p.reverseChargeBaseEurCents).toBeNull(); // erst nach Bankkorrektur
  });

  it("unbekannter Lieferant + USD: awaiting_fx, kein Kontakt, keine Positionen", () => {
    const p = buildProposal(null, ex(2999, "USD"));
    expect(p.status).toBe("awaiting_fx");
    expect(p.contactId).toBeNull();
    expect(p.items).toEqual([]);
    expect(p.reverseCharge).toBe("nein");
  });
});
