// Schlankes In-Memory-Rate-Limit mit Lockout (Plan/Review: echter Brute-Force-Schutz statt Delay).
// Hinweis: pro Instanz — die App wird mit einer Replica betrieben (Single-User + lokales Volume).

interface Entry {
  fails: number;
  lockedUntil: number;
}

const store = new Map<string, Entry>();

const MAX_FAILS = 5;
const BASE_LOCK_MS = 30_000; // 30 s nach dem 5. Fehlversuch
const MAX_LOCK_MS = 15 * 60_000; // Deckel 15 min (exponentiell)

export function rateLimitCheck(key: string, now: number): { blocked: boolean; retryAfterSec: number } {
  const e = store.get(key);
  if (e && e.lockedUntil > now) return { blocked: true, retryAfterSec: Math.ceil((e.lockedUntil - now) / 1000) };
  return { blocked: false, retryAfterSec: 0 };
}

export function rateLimitFailure(key: string, now: number): void {
  const e = store.get(key) ?? { fails: 0, lockedUntil: 0 };
  e.fails += 1;
  if (e.fails >= MAX_FAILS) {
    const over = e.fails - MAX_FAILS;
    e.lockedUntil = now + Math.min(BASE_LOCK_MS * 2 ** over, MAX_LOCK_MS);
  }
  store.set(key, e);
}

export function rateLimitSuccess(key: string): void {
  store.delete(key);
}

// Nur für Tests: Zustand zurücksetzen.
export function rateLimitReset(): void {
  store.clear();
}
