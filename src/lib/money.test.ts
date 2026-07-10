import { describe, it, expect } from "vitest";
import { eurToCents, centsToEur, formatEur, parseAmountToCents } from "./money";

describe("money", () => {
  it("eurToCents rundet korrekt", () => {
    expect(eurToCents(26)).toBe(2600);
    expect(eurToCents(29.99)).toBe(2999);
    expect(eurToCents(0.1 + 0.2)).toBe(30); // kein Fließkomma-Drift
  });

  it("centsToEur", () => {
    expect(centsToEur(2600)).toBe(26);
  });

  it("formatEur nutzt de-DE", () => {
    expect(formatEur(2600)).toContain("26,00");
  });

  it("parseAmountToCents deutsch und englisch", () => {
    expect(parseAmountToCents("1.234,56")).toBe(123456);
    expect(parseAmountToCents("1234.56")).toBe(123456);
    expect(parseAmountToCents("26,00 €")).toBe(2600);
    expect(parseAmountToCents("29,99 USD")).toBe(2999);
    expect(parseAmountToCents("-19.99")).toBe(-1999);
    expect(parseAmountToCents("18")).toBe(1800);
  });

  it("parseAmountToCents gibt null bei Unsinn", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
  });
});
