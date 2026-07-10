"use server";
import { prisma } from "@/lib/db";
import { reverseChargeVatCents } from "@/lib/reverse-charge";
import { applyFxToVoucher } from "@/lib/voucher-ops";
import { revalidatePath } from "next/cache";

export interface ReviewItem {
  categoryId: string;
  amountCents: number;
  note: string | null;
}

export interface ReviewPayload {
  dateISO: string;
  voucherNumber: string | null;
  amountCents: number;
  currency: string;
  contactId: string | null;
  reverseCharge: "ja" | "nein" | "pruefen";
  reverseChargeVatRate: number;
  paidPrivately: boolean;
  remark: string | null;
  items: ReviewItem[];
}

export type ActionResult = { ok: true } | { ok: false; error: string };

function sum(items: ReviewItem[]): number {
  return items.reduce((s, i) => s + i.amountCents, 0);
}

async function persist(id: string, p: ReviewPayload, confirm: boolean): Promise<ActionResult> {
  const current = await prisma.voucher.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "Beleg nicht gefunden." };
  if (current.status === "awaiting_fx") {
    return { ok: false, error: "Fremdwährungsbeleg: zuerst den EUR-Bankbetrag übernehmen." };
  }

  const isFx = p.currency.toUpperCase() !== "EUR";
  const rcActive = p.reverseCharge === "ja";

  if (confirm) {
    if (p.amountCents <= 0) return { ok: false, error: "Betrag fehlt." };
    if (!p.contactId) return { ok: false, error: "Lieferant fehlt." };
    if (p.items.length === 0) return { ok: false, error: "Mindestens eine Position nötig." };
    if (sum(p.items) !== p.amountCents) {
      return { ok: false, error: `Summe der Positionen (${(sum(p.items) / 100).toFixed(2)}) ≠ Brutto (${(p.amountCents / 100).toFixed(2)}).` };
    }
  }

  const rcBase = rcActive && !isFx ? p.amountCents : null;
  const rcVat = rcBase != null ? reverseChargeVatCents(rcBase, p.reverseChargeVatRate) : null;

  await prisma.$transaction([
    prisma.voucherItem.deleteMany({ where: { voucherId: id } }),
    prisma.voucher.update({
      where: { id },
      data: {
        date: new Date(p.dateISO),
        voucherNumber: p.voucherNumber || null,
        amountCents: p.amountCents,
        currency: p.currency,
        contactId: p.contactId,
        taxType: rcActive ? "reverse_charge" : "vatfree",
        reverseCharge: p.reverseCharge,
        reverseChargeVatRate: rcActive ? p.reverseChargeVatRate : null,
        reverseChargeBaseEurCents: rcBase,
        reverseChargeVatCents: rcVat,
        paidPrivately: p.paidPrivately,
        remark: p.remark || null,
        status: confirm ? "checked" : "unchecked",
        items: { create: p.items.map((i) => ({ categoryId: i.categoryId, amountCents: i.amountCents, note: i.note })) },
      },
    }),
    prisma.auditLog.create({
      data: { voucherId: id, action: confirm ? "confirm" : "update", actor: "review", newValue: `status=${confirm ? "checked" : "unchecked"}; amount=${p.amountCents}` },
    }),
  ]);

  revalidatePath(`/belege/${id}`);
  revalidatePath("/belege");
  return { ok: true };
}

export async function saveVoucher(id: string, payload: ReviewPayload): Promise<ActionResult> {
  return persist(id, payload, false);
}

export async function confirmVoucher(id: string, payload: ReviewPayload): Promise<ActionResult> {
  return persist(id, payload, true);
}

/** Fremdwährung: den tatsächlich abgebuchten EUR-Betrag übernehmen (Hard Stop, Plan Abschnitt 6). */
export async function applyFx(id: string, bankEurCents: number): Promise<ActionResult> {
  if (!Number.isInteger(bankEurCents) || bankEurCents === 0) return { ok: false, error: "Ungültiger EUR-Betrag." };
  try {
    await applyFxToVoucher(id, bankEurCents);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Korrektur fehlgeschlagen." };
  }
  revalidatePath(`/belege/${id}`);
  revalidatePath("/belege");
  return { ok: true };
}
