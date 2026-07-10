// Single-User-Auth (Plan Abschnitt 9). Signierte Session-Cookies via Web Crypto —
// funktioniert in Edge (middleware) UND Node (server actions). Keine externen Abhängigkeiten.
// Passwort steht als Secret in der Umgebung (AUTH_PASSWORD), nicht in der DB.

const enc = new TextEncoder();

export const SESSION_COOKIE = "beleg_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage (Sekunden) — stateless, per AUTH_SECRET-Rotation global widerrufbar

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

/** Konstante-Zeit-Vergleich zweier gleich langer Strings. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return toBase64Url(new Uint8Array(d));
}

export async function createSession(secret: string, nowMs: number): Promise<string> {
  const payload = toBase64Url(enc.encode(JSON.stringify({ exp: nowMs + SESSION_MAX_AGE * 1000 })));
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySession(secret: string, token: string | undefined, nowMs: number): Promise<boolean> {
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSign(secret, payload);
  if (!timingSafeEqual(sig, expected)) return false;
  try {
    const obj = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return typeof obj.exp === "number" && obj.exp > nowMs;
  } catch {
    return false;
  }
}

/** Passwortprüfung in konstanter Zeit (über SHA-256-Digest). */
export async function verifyPassword(input: string, expected: string | undefined): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([sha256(input), sha256(expected)]);
  return timingSafeEqual(a, b);
}

/**
 * Nur interne Pfade als Redirect-Ziel zulassen (kein Open-Redirect).
 * Genau ein führender Slash, danach KEIN / oder \ (blockt //evil.com und den Backslash-Trick /\evil.com,
 * den Browser gemäß WHATWG-URL zu //evil.com normalisieren) und keine Control-Chars.
 */
export function safeRedirectPath(from: string | undefined): string {
  if (!from) return "/";
  if (from.charAt(0) !== "/") return "/"; // muss mit einem Slash beginnen
  const second = from.charAt(1);
  if (second === "/" || second === "\\") return "/"; // blockt //evil und den Backslash-Trick /\evil
  for (let i = 0; i < from.length; i++) {
    if (from.charCodeAt(i) < 0x20) return "/"; // keine Control-Chars
  }
  return from;
}
