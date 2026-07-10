import { describe, it, expect } from "vitest";
import { split70_30, splitByPercent, sumEqualsGross } from "./split";

describe("split", () => {
  it("Telekom 26,00 € → 18,20 / 7,80 (Skill-Beispiel)", () => {
    const { businessCents, privatCents } = split70_30(2600);
    expect(businessCents).toBe(1820);
    expect(privatCents).toBe(780);
    expect(sumEqualsGross([businessCents, privatCents], 2600)).toBe(true);
  });

  it("Summen-Invariante hält für krumme Beträge", () => {
    for (const gross of [2599, 1801, 9999, 1, 12345, 4818]) {
      const { businessCents, privatCents } = split70_30(gross);
      expect(businessCents + privatCents).toBe(gross);
    }
  });

  it("splitByPercent validiert Eingaben", () => {
    expect(() => splitByPercent(100.5, 70)).toThrow();
    expect(() => splitByPercent(100, 150)).toThrow();
  });

  it("Betriebsanteil wird gerundet, Privat = Rest", () => {
    // 1801 * 0.7 = 1260.7 → 1261 Betrieb, 540 Privat
    expect(splitByPercent(1801, 70)).toEqual({ businessCents: 1261, privatCents: 540 });
  });
});
