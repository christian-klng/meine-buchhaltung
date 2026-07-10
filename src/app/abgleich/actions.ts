"use server";
import { prisma } from "@/lib/db";
import { applyFxToVoucher } from "@/lib/voucher-ops";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Bestätigt eine Beleg↔Buchung-Zuordnung. Bei Fremdwährung wird der EUR-Betrag automatisch übernommen. */
export async function confirmMatch(voucherId: string, transactionId: string, confidence: number): Promise<ActionResult> {
  const [voucher, tx] = await Promise.all([
    prisma.voucher.findUnique({ where: { id: voucherId } }),
    prisma.bankTransaction.findUnique({ where: { id: transactionId } }),
  ]);
  if (!voucher || !tx) return { ok: false, error: "Beleg oder Buchung nicht gefunden." };

  await prisma.reconciliationLink.upsert({
    where: { voucherId_bankTransactionId: { voucherId, bankTransactionId: transactionId } },
    update: { status: "matched", confidence },
    create: { voucherId, bankTransactionId: transactionId, status: "matched", confidence },
  });

  // Fremdwährung: den tatsächlich abgebuchten EUR-Betrag aus der Buchung übernehmen (Hard Stop erfüllt).
  if (voucher.status === "awaiting_fx") {
    await applyFxToVoucher(voucherId, tx.amountCents);
  }

  await prisma.auditLog.create({
    data: { voucherId, action: "reconcile", actor: "abgleich", newValue: `tx=${transactionId}; conf=${confidence}` },
  });

  revalidatePath("/abgleich");
  revalidatePath("/belege");
  revalidatePath(`/belege/${voucherId}`);
  return { ok: true };
}

export async function markPrivate(voucherId: string): Promise<ActionResult> {
  await prisma.voucher.update({ where: { id: voucherId }, data: { paidPrivately: true } });
  await prisma.auditLog.create({ data: { voucherId, action: "mark_private", actor: "abgleich" } });
  revalidatePath("/abgleich");
  revalidatePath("/belege");
  return { ok: true };
}
