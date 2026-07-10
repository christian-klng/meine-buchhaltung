// Programmatische Extraktion aus Beleg-Text (Plan Abschnitt 2/6). Rein & testbar — kein PDF-I/O hier.
// Reihenfolge bewusst: Währung ZUERST (Review B4), dann Betrag (Datumsangaben vorher ausmaskiert,
// damit "31.12.2026" nicht als 31,12 € missverstanden wird), Datum, Belegnummer, Lieferant.
import { parseAmountToCents } from "./money";

export interface ExtractedFields {
  currency: string; // aus dem Text erkannt (EUR-Default); die VendorRule kann das später überschreiben
  amountCents: number | null;
  date: Date | null;
  voucherNumber: string | null;
  hasText: boolean;
}

const AMOUNT_LABELS = /(gesamt|summe|rechnungsbetrag|zu zahlen|zahlbetrag|total|amount due|total due|grand total|betrag)/i;
const DATE_LABELS = /(rechnungsdatum|belegdatum|invoice date|rechnungs-?datum|datum|date|issued)/i;
const NUMBER_LABELS = /(rechnungs-?nummer|rechnungs-?nr|invoice\s*(no|number|#)|beleg-?nr|beleg-?nummer|receipt\s*(no|number))/i;

// Datumsformate: 31.12.2026 / 31.12.26 / 31/12/2026 / 2026-12-31
const DATE_RE = /\b(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/g;
// Beträge mit 2 Nachkommastellen und optionalen Tausendertrennern (DE & EN).
const AMOUNT_RE = /\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?!\d)/g;

export function detectCurrency(text: string): string {
  const t = text.toLowerCase();
  // Explizite Codes zuerst, dann Symbole. EUR gewinnt nur, wenn USD nicht auftaucht.
  const usd = /\busd\b|us\$|\$\s?\d|\d\s?\$/i.test(text);
  const eur = /\beur\b|€/i.test(text);
  if (usd && !eur) return "USD";
  if (usd && eur) return "USD"; // im Zweifel Fremdwährung markieren → Hard Stop
  if (eur) return "EUR";
  if (/\bgbp\b|£/.test(text)) return "GBP";
  void t;
  return "EUR";
}

function parseDateParts(m: RegExpMatchArray): Date | null {
  let y: number, mo: number, d: number;
  if (m[4]) {
    // ISO YYYY-MM-DD
    y = +m[4];
    mo = +m[5];
    d = +m[6];
  } else {
    d = +m[1];
    mo = +m[2];
    y = +m[3];
    if (y < 100) y += 2000;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
}

interface Found<T> {
  value: T;
  index: number;
}

function findDates(text: string): Found<Date>[] {
  const out: Found<Date>[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const date = parseDateParts(m);
    if (date) out.push({ value: date, index: m.index ?? 0 });
  }
  return out;
}

/** Wählt den Wert, der einem beschrifteten Label am nächsten (davor) steht; sonst den Fallback. */
function pickNearLabel<T>(candidates: Found<T>[], text: string, label: RegExp, fallback: (c: Found<T>[]) => T | null): T | null {
  if (candidates.length === 0) return null;
  let best: Found<T> | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    // Suche das nächste Label links vom Kandidaten in einem Fenster von 40 Zeichen.
    const windowStart = Math.max(0, c.index - 40);
    const before = text.slice(windowStart, c.index);
    if (label.test(before)) {
      const dist = c.index - windowStart;
      if (dist < bestDist) {
        best = c;
        bestDist = dist;
      }
    }
  }
  return best ? best.value : fallback(candidates);
}

export function extractDate(text: string): Date | null {
  const dates = findDates(text);
  return pickNearLabel(dates, text, DATE_LABELS, (c) => c[0]?.value ?? null);
}

export function extractAmountCents(text: string): number | null {
  // Datumsangaben ausmaskieren, damit sie nicht als Beträge zählen.
  const masked = text.replace(DATE_RE, (m) => " ".repeat(m.length));
  const candidates: Found<number>[] = [];
  for (const m of masked.matchAll(AMOUNT_RE)) {
    const cents = parseAmountToCents(m[0]);
    if (cents != null && cents > 0) candidates.push({ value: cents, index: m.index ?? 0 });
  }
  if (candidates.length === 0) return null;
  // Bevorzugt: Betrag in der Nähe eines Summen-Labels (größter davon). Sonst: größter Betrag insgesamt.
  const labeled = candidates.filter((c) => {
    const before = masked.slice(Math.max(0, c.index - 40), c.index);
    return AMOUNT_LABELS.test(before);
  });
  const pool = labeled.length > 0 ? labeled : candidates;
  return pool.reduce((max, c) => (c.value > max ? c.value : max), 0);
}

export function extractVoucherNumber(text: string): string | null {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (NUMBER_LABELS.test(line)) {
      // Token nach dem Label: Buchstaben/Ziffern/Bindestriche, mind. 2 Zeichen.
      const after = line.replace(NUMBER_LABELS, "###");
      const m = after.match(/###[^A-Za-z0-9]*([A-Za-z0-9][A-Za-z0-9\-\/.]{1,})/);
      if (m) return m[1].replace(/[.]+$/, "");
    }
  }
  return null;
}

export function extractFields(text: string): ExtractedFields {
  const hasText = text.trim().length > 0;
  return {
    currency: detectCurrency(text),
    amountCents: extractAmountCents(text),
    date: extractDate(text),
    voucherNumber: extractVoucherNumber(text),
    hasText,
  };
}

// ── Lieferanten-Erkennung ──
export interface VendorPattern {
  contactId: string;
  name: string;
  matchStrings: string[];
  matchDomains: string[];
}

/** Findet den passenden Lieferanten über matchStrings/matchDomains im Text (längster Treffer gewinnt). */
export function matchVendor(text: string, vendors: VendorPattern[]): VendorPattern | null {
  const hay = text.toLowerCase();
  let best: VendorPattern | null = null;
  let bestLen = 0;
  for (const v of vendors) {
    const needles = [...v.matchStrings, ...v.matchDomains].map((s) => s.toLowerCase()).filter(Boolean);
    for (const n of needles) {
      if (hay.includes(n) && n.length > bestLen) {
        best = v;
        bestLen = n.length;
      }
    }
  }
  return best;
}
