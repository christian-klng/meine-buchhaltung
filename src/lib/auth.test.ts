import { describe, it, expect } from "vitest";
import { createSession, verifySession, verifyPassword, safeRedirectPath, SESSION_MAX_AGE } from "./auth";

const SECRET = "test-secret-abcdefghijklmnop";
const NOW = 1_700_000_000_000;

describe("auth — safeRedirectPath (Open-Redirect-Schutz)", () => {
  it("lässt interne Pfade zu", () => {
    expect(safeRedirectPath("/belege")).toBe("/belege");
    expect(safeRedirectPath("/belege/123?x=1")).toBe("/belege/123?x=1");
  });
  it("blockt externe/Protokoll-relative Ziele und den Backslash-Trick", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/"); // Browser normalisieren \ zu /
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("/\t/evil")).toBe("/"); // Control-Char
    expect(safeRedirectPath("/")).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
  });
});

describe("auth — Session (HMAC)", () => {
  it("gültiges Token wird akzeptiert (Roundtrip)", async () => {
    const token = await createSession(SECRET, NOW);
    expect(await verifySession(SECRET, token, NOW + 1000)).toBe(true);
  });
  it("falsches Secret wird abgelehnt", async () => {
    const token = await createSession(SECRET, NOW);
    expect(await verifySession("anderes-secret", token, NOW + 1000)).toBe(false);
  });
  it("abgelaufenes Token wird abgelehnt", async () => {
    const token = await createSession(SECRET, NOW);
    expect(await verifySession(SECRET, token, NOW + SESSION_MAX_AGE * 1000 + 1)).toBe(false);
  });
  it("manipulierte Signatur wird abgelehnt", async () => {
    const token = await createSession(SECRET, NOW);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(await verifySession(SECRET, tampered, NOW + 1000)).toBe(false);
  });
  it("leeres Secret/Token wird abgelehnt", async () => {
    expect(await verifySession("", await createSession(SECRET, NOW), NOW)).toBe(false);
    expect(await verifySession(SECRET, undefined, NOW)).toBe(false);
    expect(await verifySession(SECRET, "kaputt", NOW)).toBe(false);
  });
});

describe("auth — verifyPassword", () => {
  it("korrektes Passwort", async () => {
    expect(await verifyPassword("geheim", "geheim")).toBe(true);
  });
  it("falsches Passwort / kein Passwort gesetzt", async () => {
    expect(await verifyPassword("falsch", "geheim")).toBe(false);
    expect(await verifyPassword("geheim", undefined)).toBe(false);
    expect(await verifyPassword("", "")).toBe(false);
  });
});
