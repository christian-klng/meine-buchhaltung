// Bankabgleich (Plan Abschnitt 6). Beleg↔Buchung über Betrag (Cent) + Datumsfenster + Gegenpartei.
// Ausnahme Fremdwährung (`awaiting_fx`): der Belegbetrag ist noch der falsche 1:1-Wert → NUR über
// Gegenpartei + Datum matchen (ohne Betrag). Duplikate belegintrinsisch über voucherNumber + Betrag.

export interface VoucherLike {
  id: string;
  date: Date;
  amountCents: number; // EUR brutto (positiv)
  currency: string;
  status: string; // u. a. "awaiting_fx"
  counterparty?: string | null;
  voucherNumber?: string | null;
  paidPrivately?: boolean;
}

export interface TxLike {
  id: string;
  date: Date;
  amountCents: number; // vorzeichenbehaftet: negativ = Abbuchung
  counterparty?: string | null;
  purpose?: string | null;
}

export interface MatchCandidate {
  voucherId: string;
  transactionId: string;
  confidence: number; // 0..100
  reason: string;
}

export interface ReconcileOptions {
  dateWindowDays?: number;
  minNameSimilarity?: number;
}

const DAY_MS = 86_400_000;

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

const LEGAL_FORMS = /\b(gmbh|ag|inc|ltd|llc|co|kg|se|bv|corporation|corp|mbh|ug|plc)\b/g;

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(LEGAL_FORMS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ähnlichkeit 0..1 über Bigramm-Dice + Substring-Bonus. */
export function nameSimilarity(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (nb.includes(na) || na.includes(nb)) return 0.9;
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(na);
  const B = bigrams(nb);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const [g, ca] of A) {
    const cb = B.get(g);
    if (cb) inter += Math.min(ca, cb);
  }
  const total = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  return (2 * inter) / total;
}

function isFxVoucher(v: VoucherLike): boolean {
  return v.currency.trim().toUpperCase() !== "EUR" || v.status === "awaiting_fx";
}

/** Kandidaten-Matches für einen Beleg, nach Konfidenz absteigend. */
export function matchCandidates(v: VoucherLike, txs: TxLike[], opts: ReconcileOptions = {}): MatchCandidate[] {
  const win = opts.dateWindowDays ?? 5;
  const minSim = opts.minNameSimilarity ?? 0.4;
  const fx = isFxVoucher(v);
  const out: MatchCandidate[] = [];
  for (const tx of txs) {
    if (daysBetween(v.date, tx.date) > win) continue;
    const sim = nameSimilarity(v.counterparty, tx.counterparty ?? tx.purpose);
    if (fx) {
      // Fremdwährung: OHNE Betrag, nur Gegenpartei + Datum.
      if (sim >= minSim) {
        out.push({ voucherId: v.id, transactionId: tx.id, confidence: Math.round(45 + sim * 45), reason: "Fremdwährung: Gegenpartei + Datum" });
      }
    } else {
      if (Math.abs(tx.amountCents) === Math.abs(v.amountCents)) {
        const withName = sim >= minSim;
        out.push({ voucherId: v.id, transactionId: tx.id, confidence: Math.round(70 + sim * 30), reason: withName ? "Betrag + Datum + Gegenpartei" : "Betrag + Datum" });
      }
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

export interface DuplicateGroup {
  key: string;
  voucherIds: string[];
}

/** Duplikate über gleiche voucherNumber UND gleichen Betrag (funktioniert ohne Bankdaten). */
export function findDuplicates(vouchers: VoucherLike[]): DuplicateGroup[] {
  const map = new Map<string, string[]>();
  for (const v of vouchers) {
    if (!v.voucherNumber) continue; // ohne Nummer nicht sicher als Duplikat bestimmbar
    const key = `${v.voucherNumber.trim().toLowerCase()}::${v.amountCents}`;
    const arr = map.get(key) ?? [];
    arr.push(v.id);
    map.set(key, arr);
  }
  return [...map.entries()].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, voucherIds: ids }));
}

export interface ReconcileResult {
  matches: MatchCandidate[]; // je Beleg/Buchung höchstens ein (greedy best-first) Vorschlag
  vouchersWithoutTx: string[]; // fehlende Abbuchung (ggf. privat bezahlt ausgenommen)
  transactionsWithoutVoucher: string[]; // Buchung ohne Beleg → "bitte nachreichen"
  duplicates: DuplicateGroup[];
}

export function reconcile(vouchers: VoucherLike[], txs: TxLike[], opts?: ReconcileOptions): ReconcileResult {
  const all = vouchers.flatMap((v) => matchCandidates(v, txs, opts));
  all.sort((a, b) => b.confidence - a.confidence);

  const matches: MatchCandidate[] = [];
  const usedTx = new Set<string>();
  const matchedVouchers = new Set<string>();
  for (const c of all) {
    if (matchedVouchers.has(c.voucherId) || usedTx.has(c.transactionId)) continue;
    matches.push(c);
    matchedVouchers.add(c.voucherId);
    usedTx.add(c.transactionId);
  }

  const vouchersWithoutTx = vouchers.filter((v) => !matchedVouchers.has(v.id) && !v.paidPrivately).map((v) => v.id);
  const transactionsWithoutVoucher = txs.filter((t) => !usedTx.has(t.id)).map((t) => t.id);
  return { matches, vouchersWithoutTx, transactionsWithoutVoucher, duplicates: findDuplicates(vouchers) };
}
