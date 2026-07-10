// Bankauszug einlesen und persistieren. Dedup über Datei-Hash (kein doppelter Import).
import { prisma } from "../db";
import { hashBuffer } from "../storage";
import { parseBankFile } from "./parse";

export interface BankImportResult {
  statementId: string;
  format: string;
  count: number;
  duplicate: boolean;
}

export async function importBankFile(buf: Buffer, fileName: string): Promise<BankImportResult> {
  const rawHash = hashBuffer(buf);
  const existing = await prisma.bankStatement.findFirst({
    where: { rawHash },
    select: { id: true, format: true, _count: { select: { transactions: true } } },
  });
  if (existing) return { statementId: existing.id, format: existing.format, count: existing._count.transactions, duplicate: true };

  const content = buf.toString("utf8").replace(/^﻿/, "");
  const parsed = parseBankFile(content);

  const stmt = await prisma.bankStatement.create({
    data: {
      format: parsed.format,
      account: parsed.account,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      fileName,
      rawHash,
      transactions: {
        create: parsed.transactions.map((t) => ({
          date: t.date,
          amountCents: t.amountCents,
          currency: t.currency,
          counterparty: t.counterparty,
          purpose: t.purpose,
          rawRef: t.rawRef,
        })),
      },
    },
    include: { _count: { select: { transactions: true } } },
  });

  return { statementId: stmt.id, format: parsed.format, count: stmt._count.transactions, duplicate: false };
}
