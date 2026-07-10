// Generischer CSV-Parser mit Spalten-Auto-Erkennung (Plan Abschnitt 8). Deutsches Zahlen-/Datumsformat.
import { parseAmountToCents } from "../money";
import type { ParsedStatement, ParsedTx } from "./types";

const HEADER_MAP = {
  date: ["buchungstag", "buchung", "valutadatum", "valuta", "datum", "booking date", "date"],
  amount: ["betrag", "umsatz", "amount", "value"],
  counterparty: [
    "empfänger", "empfaenger", "auftraggeber", "begünstigter", "beguenstigter",
    "zahlungsempfänger", "zahlungsempfaenger", "zahlungspflichtiger", "beneficiary", "payee", "name", "counterparty",
  ],
  purpose: ["verwendungszweck", "buchungstext", "zweck", "purpose", "reference", "description", "remittance"],
  currency: ["währung", "waehrung", "currency", "ccy"],
};

function detectDelimiter(line: string): string {
  const semi = (line.match(/;/g) ?? []).length;
  const comma = (line.match(/,/g) ?? []).length;
  const tab = (line.match(/\t/g) ?? []).length;
  if (tab >= semi && tab >= comma && tab > 0) return "\t";
  return semi >= comma ? ";" : ",";
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === delim && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function findCol(headers: string[], names: string[]): number {
  const low = headers.map((h) => h.toLowerCase());
  for (const n of names) {
    const i = low.findIndex((h) => h.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

function parseGermanDate(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    const d = new Date(Date.UTC(y, +m[2] - 1, +m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return null;
}

export function parseCsv(content: string): ParsedStatement {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV: keine Datenzeilen.");
  const delim = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delim);
  const ci = {
    date: findCol(headers, HEADER_MAP.date),
    amount: findCol(headers, HEADER_MAP.amount),
    cp: findCol(headers, HEADER_MAP.counterparty),
    purpose: findCol(headers, HEADER_MAP.purpose),
    ccy: findCol(headers, HEADER_MAP.currency),
  };
  if (ci.date < 0 || ci.amount < 0) {
    throw new Error(`CSV: Datums- oder Betragsspalte nicht erkannt (Header: ${headers.join(", ")}).`);
  }

  const transactions: ParsedTx[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r], delim);
    const date = parseGermanDate(cells[ci.date] ?? "");
    const amountCents = parseAmountToCents(cells[ci.amount] ?? "");
    if (!date || amountCents == null) continue;
    transactions.push({
      date,
      amountCents,
      currency: (ci.ccy >= 0 ? cells[ci.ccy] : "") || "EUR",
      counterparty: (ci.cp >= 0 ? cells[ci.cp] : "") || null,
      purpose: (ci.purpose >= 0 ? cells[ci.purpose] : "") || null,
      rawRef: null,
    });
  }

  const times = transactions.map((t) => t.date.getTime());
  return {
    format: "csv",
    account: null,
    periodStart: times.length ? new Date(Math.min(...times)) : null,
    periodEnd: times.length ? new Date(Math.max(...times)) : null,
    transactions,
  };
}
