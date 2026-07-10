// Geld immer als Integer-Cent. Nie Fließkomma-Arithmetik auf Beträgen (Plan Abschnitt 5/6).

export function eurToCents(eur: number): number {
  return Math.round(eur * 100);
}

export function centsToEur(cents: number): number {
  return cents / 100;
}

export function formatAmount(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

export function formatEur(cents: number): string {
  return formatAmount(cents, "EUR");
}

/**
 * Parst einen deutschen oder englischen Betragsstring nach Cent.
 * Beispiele: "1.234,56" → 123456, "1234.56" → 123456, "26,00 €" → 2600, "-19.99" → -1999.
 * Gibt null zurück, wenn nichts Sinnvolles erkennbar ist.
 */
export function parseAmountToCents(input: string): number | null {
  const raw = input.trim().replace(/[€$\s]/g, "").replace(/[A-Za-z]/g, "");
  if (!raw) return null;
  const neg = /^-/.test(raw) || /-$/.test(raw);
  let s = raw.replace(/[+\-]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Das zuletzt auftretende Trennzeichen ist das Dezimaltrennzeichen.
    const decSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    s = s.split(thouSep).join("").replace(decSep, ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const val = Number(s);
  if (!Number.isFinite(val)) return null;
  const cents = Math.round(val * 100);
  return neg ? -cents : cents;
}
