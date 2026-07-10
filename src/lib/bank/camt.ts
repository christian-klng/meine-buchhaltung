// camt.052/053-Parser (ISO 20022). Defensiv gegen Versions- und Struktur-Varianten.
import { XMLParser } from "fast-xml-parser";
import type { ParsedStatement, ParsedTx } from "./types";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function arr<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function text(x: Any): string | null {
  if (x == null) return null;
  if (typeof x === "object") return x["#text"] != null ? String(x["#text"]) : null;
  return String(x);
}

function parseDate(x: Any): Date | null {
  const s = text(x?.Dt) ?? text(x?.DtTm) ?? text(x);
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function partyName(p: Any): string | null {
  if (!p) return null;
  return text(p.Nm) ?? text(p.Pty?.Nm) ?? null;
}

export function parseCamt(xml: string): ParsedStatement {
  const doc = parser.parse(xml)?.Document;
  if (!doc) throw new Error("Kein <Document> — keine gültige camt-Datei.");

  const is053 = !!doc.BkToCstmrStmt;
  const root = doc.BkToCstmrStmt?.Stmt ?? doc.BkToCstmrAcctRpt?.Rpt;
  const reports = arr<Any>(root);
  if (reports.length === 0) throw new Error("Kein Stmt/Rpt-Element in der camt-Datei.");

  const transactions: ParsedTx[] = [];
  let account: string | null = null;
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;

  for (const rpt of reports) {
    account = account ?? text(rpt.Acct?.Id?.IBAN) ?? text(rpt.Acct?.Id?.Othr?.Id);
    periodStart = periodStart ?? parseDate(rpt.FrToDt?.FrDtTm ? { DtTm: rpt.FrToDt.FrDtTm } : rpt.FrToDt?.FrDt);
    periodEnd = periodEnd ?? parseDate(rpt.FrToDt?.ToDtTm ? { DtTm: rpt.FrToDt.ToDtTm } : rpt.FrToDt?.ToDt);

    for (const ntry of arr<Any>(rpt.Ntry)) {
      const cdi = text(ntry.CdtDbtInd); // CRDT | DBIT
      const sign = cdi === "DBIT" ? -1 : 1;
      const amtRaw = text(ntry.Amt);
      const ccy = (typeof ntry.Amt === "object" ? ntry.Amt?.["@_Ccy"] : null) ?? "EUR";
      const val = amtRaw ? parseFloat(amtRaw) : NaN;
      if (Number.isNaN(val)) continue;
      const amountCents = sign * Math.round(val * 100);

      const date = parseDate(ntry.BookgDt) ?? parseDate(ntry.ValDt);
      const td = arr<Any>(ntry.NtryDtls?.TxDtls)[0];
      const rlt = td?.RltdPties;
      const cdtr = partyName(rlt?.Cdtr);
      const dbtr = partyName(rlt?.Dbtr);
      const counterparty = cdi === "DBIT" ? cdtr ?? dbtr : dbtr ?? cdtr;
      const purpose =
        arr<Any>(td?.RmtInf?.Ustrd).map(text).filter(Boolean).join(" ") || text(ntry.AddtlNtryInf) || null;
      const rawRef = text(ntry.AcctSvcrRef) ?? text(td?.Refs?.AcctSvcrRef) ?? text(td?.Refs?.EndToEndId);

      transactions.push({
        date: date ?? new Date(),
        amountCents,
        currency: ccy,
        counterparty: counterparty || null,
        purpose: purpose || null,
        rawRef: rawRef || null,
      });
    }
  }

  return { format: is053 ? "camt053" : "camt052", account, periodStart, periodEnd, transactions };
}
