import { describe, it, expect, beforeEach } from "vitest";
import { rateLimitCheck, rateLimitFailure, rateLimitSuccess, rateLimitReset } from "./rate-limit";

beforeEach(() => rateLimitReset());

describe("rate-limit", () => {
  it("erlaubt bis zur Schwelle, sperrt danach", () => {
    const now = 1000;
    for (let i = 0; i < 4; i++) {
      expect(rateLimitCheck("ip", now).blocked).toBe(false);
      rateLimitFailure("ip", now);
    }
    // 5. Fehlversuch löst Lockout aus
    expect(rateLimitCheck("ip", now).blocked).toBe(false);
    rateLimitFailure("ip", now);
    const r = rateLimitCheck("ip", now);
    expect(r.blocked).toBe(true);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("Lockout läuft nach Ablauf wieder frei", () => {
    const now = 1000;
    for (let i = 0; i < 5; i++) rateLimitFailure("ip", now);
    expect(rateLimitCheck("ip", now).blocked).toBe(true);
    expect(rateLimitCheck("ip", now + 16 * 60_000).blocked).toBe(false);
  });

  it("Erfolg setzt den Zähler zurück", () => {
    const now = 1000;
    for (let i = 0; i < 5; i++) rateLimitFailure("ip", now);
    rateLimitSuccess("ip");
    expect(rateLimitCheck("ip", now).blocked).toBe(false);
  });

  it("verschiedene Keys sind unabhängig", () => {
    const now = 1000;
    for (let i = 0; i < 5; i++) rateLimitFailure("a", now);
    expect(rateLimitCheck("a", now).blocked).toBe(true);
    expect(rateLimitCheck("b", now).blocked).toBe(false);
  });
});
