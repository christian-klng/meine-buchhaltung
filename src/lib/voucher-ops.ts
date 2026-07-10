// Server-seitige Beleg-Mutationen, die von mehreren Stellen genutzt werden
// (manueller FX-Button UND Bankabgleich-Bestätigung).
import { prisma } from "./db";
import { applyBankEurAmount } from "./fx";
import { splitByPercent } from "./split";

/**
 * Übernimmt den tatsächlich abgebuchten EUR-Betrag in einen Fremdwährungsbeleg (Hard Stop),
 * bildet die Positionen aus der Lieferanten-Regel neu und hebt den Status auf `unchecked`.
 */
export async function applyFxToVoucher(voucherId: string, bankEurCents: number): Promise<void> {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: { contact: { include: { vendorRule: true } } },
  });
  if (!voucher) throw new Error("Beleg nicht gefunden");

  const patch = applyBankEurAmount(
    {
      currency: voucher.currency,
      amountCents: voucher.amountCents,
      originalAmountCents: voucher.originalAmountCents,
      remark: voucher.remark,
      reverseCharge: voucher.reverseCharge,
      reverseChargeVatRate: voucher.reverseChargeVatRate,
    },
    bankEurCents,
  );

  const vr = voucher.contact?.vendorRule ?? null;
  const items: { categoryId: string; amountCents: number; note: string | null }[] = [];
  if (vr) {
    if (vr.splitType === "split_70_30" && vr.businessCategoryId && vr.privatCategoryId) {
      const { businessCents, privatCents } = splitByPercent(patch.amountCents, vr.businessPercent ?? 70);
      items.push({ categoryId: vr.businessCategoryId, amountCents: businessCents, note: "Betrieb" });
      items.push({ categoryId: vr.privatCategoryId, amountCents: privatCents, note: "Privatentnahme" });
    } else if (vr.defaultCategoryId) {
      items.push({ categoryId: vr.defaultCategoryId, amountCents: patch.amountCents, note: null });
    }
  }

  await prisma.$transaction([
    prisma.voucherItem.deleteMany({ where: { voucherId } }),
    prisma.voucher.update({
      where: { id: voucherId },
      data: {
        amountCents: patch.amountCents,
        originalAmountCents: patch.originalAmountCents,
        currency: "EUR",
        status: "unchecked",
        remark: patch.remark,
        reverseChargeBaseEurCents: patch.reverseChargeBaseEurCents,
        reverseChargeVatCents: patch.reverseChargeVatCents,
        reverseChargeVatRate: patch.reverseChargeVatRate,
        items: { create: items },
      },
    }),
    prisma.auditLog.create({ data: { voucherId, action: "fx_correction", actor: "review", newValue: `amountEUR=${patch.amountCents}` } }),
  ]);
}
