import { describe, it, expect } from "vitest";
import { isForeignCurrency, applyBankEurAmount, type FxVoucherState } from "./fx";

describe("fx", () => {
  it("erkennt Fremdwährung", () => {
    expect(isForeignCurrency("USD")).toBe(true);
    expect(isForeignCurrency("eur")).toBe(false);
    expect(isForeignCurrency("EUR")).toBe(false);
  });

  it("übernimmt Bankbetrag (Abbuchung negativ), setzt Original + remark, kein RC", () => {
    const v: FxVoucherState = {
      currency: "USD",
      amountCents: 2999, // falscher 1:1-Wert
      originalAmountCents: null,
      remark: null,
      reverseCharge: "nein",
      reverseChargeVatRate: null,
    };
    const patch = applyBankEurAmount(v, -2799);
    expect(patch.amountCents).toBe(2799);
    expect(patch.originalAmountCents).toBe(2999);
    expect(patch.status).toBe("unchecked");
    expect(patch.remark).toContain("29.99 USD");
    expect(patch.remark).toContain("EUR lt. Bankabbuchung");
    expect(patch.reverseChargeBaseEurCents).toBeNull();
    expect(patch.reverseChargeVatCents).toBeNull();
  });

  it("Unipile: Fremdwährung UND § 13b → Basis = EUR-Betrag, USt berechnet", () => {
    const v: FxVoucherState = {
      currency: "USD",
      amountCents: 5000,
      originalAmountCents: null,
      remark: null,
      reverseCharge: "ja",
      reverseChargeVatRate: 19,
    };
    const patch = applyBankEurAmount(v, -4818);
    expect(patch.amountCents).toBe(4818);
    expect(patch.reverseChargeBaseEurCents).toBe(4818);
    expect(patch.reverseChargeVatCents).toBe(915);
    expect(patch.reverseChargeVatRate).toBe(19);
  });

  it("dupliziert den Bank-Hinweis nicht", () => {
    const v: FxVoucherState = {
      currency: "USD",
      amountCents: 2799,
      originalAmountCents: 2999,
      remark: "Original 29.99 USD; EUR lt. Bankabbuchung",
      reverseCharge: "nein",
      reverseChargeVatRate: null,
    };
    const patch = applyBankEurAmount(v, -2799);
    expect(patch.remark.match(/EUR lt. Bankabbuchung/g)?.length).toBe(1);
  });
});
