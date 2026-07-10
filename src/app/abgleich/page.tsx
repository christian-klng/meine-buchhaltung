import Link from "next/link";
import { prisma } from "@/lib/db";
import { reconcile, type VoucherLike, type TxLike } from "@/lib/reconciliation";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { AbgleichClient, type MatchView, type TxView, type VoucherView, type DupView } from "./abgleich-client";

export const dynamic = "force-dynamic";

export default async function AbgleichPage() {
  const [voucherRows, txRows, stmtCount] = await Promise.all([
    prisma.voucher.findMany({
      where: { paidPrivately: false, reconLinks: { none: { status: "matched" } } },
      include: { contact: true },
    }),
    prisma.bankTransaction.findMany({
      where: { amountCents: { lt: 0 }, reconLinks: { none: { status: "matched" } } },
    }),
    prisma.bankStatement.count(),
  ]);

  if (stmtCount === 0) {
    return (
      <div>
        <PageHeader title="Abgleich" subtitle="Beleg ↔ Bankbuchung." />
        <EmptyState title="Noch kein Bankauszug importiert.">
          Importiere zuerst einen Auszug unter{" "}
          <Link href="/bank" className="text-blue-600 underline">
            Bank-Import
          </Link>
          , dann werden Belege und Buchungen automatisch zugeordnet.
        </EmptyState>
      </div>
    );
  }

  const vouchers: VoucherLike[] = voucherRows.map((v) => ({
    id: v.id,
    date: v.date,
    amountCents: v.amountCents,
    currency: v.currency,
    status: v.status,
    counterparty: v.contact?.name ?? null,
    voucherNumber: v.voucherNumber,
    paidPrivately: v.paidPrivately,
  }));
  const txs: TxLike[] = txRows.map((t) => ({
    id: t.id,
    date: t.date,
    amountCents: t.amountCents,
    counterparty: t.counterparty,
    purpose: t.purpose,
  }));

  const result = reconcile(vouchers, txs, { dateWindowDays: 7 });

  const vById = new Map(voucherRows.map((v) => [v.id, v]));
  const tById = new Map(txRows.map((t) => [t.id, t]));

  const matches: MatchView[] = result.matches.map((m) => {
    const v = vById.get(m.voucherId)!;
    const t = tById.get(m.transactionId)!;
    return {
      voucherId: m.voucherId,
      transactionId: m.transactionId,
      confidence: m.confidence,
      reason: m.reason,
      voucherLabel: v.contact?.name ?? "Unbekannter Lieferant",
      voucherAmountCents: v.amountCents,
      voucherDateISO: v.date.toISOString(),
      fx: v.status === "awaiting_fx",
      txLabel: t.counterparty ?? t.purpose ?? "Buchung",
      txAmountCents: t.amountCents,
      txDateISO: t.date.toISOString(),
    };
  });

  const missingTx: TxView[] = result.transactionsWithoutVoucher.map((id) => {
    const t = tById.get(id)!;
    return { id, label: t.counterparty ?? "Buchung", amountCents: t.amountCents, dateISO: t.date.toISOString(), purpose: t.purpose };
  });
  const missingVoucher: VoucherView[] = result.vouchersWithoutTx.map((id) => {
    const v = vById.get(id)!;
    return { id, label: v.contact?.name ?? "Unbekannter Lieferant", amountCents: v.amountCents, dateISO: v.date.toISOString(), status: v.status };
  });
  const duplicates: DupView[] = result.duplicates.map((d) => ({
    key: d.key,
    vouchers: d.voucherIds.map((id) => ({ id, label: vById.get(id)?.contact?.name ?? id })),
  }));

  return (
    <div>
      <PageHeader
        title="Abgleich"
        subtitle="Beleg ↔ Bankbuchung. Fremdwährungsbelege werden beim Zuordnen automatisch in EUR korrigiert."
        action={
          <Link href="/bank" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50">
            Bank-Import
          </Link>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Vorschläge" value={matches.length} tone={matches.length ? "blue" : "neutral"} />
        <StatCard label="Buchungen o. Beleg" value={missingTx.length} tone={missingTx.length ? "amber" : "neutral"} />
        <StatCard label="Belege o. Buchung" value={missingVoucher.length} />
        <StatCard label="Duplikate" value={duplicates.length} tone={duplicates.length ? "amber" : "neutral"} />
      </div>

      <AbgleichClient matches={matches} missingTx={missingTx} missingVoucher={missingVoucher} duplicates={duplicates} />
    </div>
  );
}
