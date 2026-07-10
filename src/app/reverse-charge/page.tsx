import { prisma } from "@/lib/db";
import { PageHeader, Badge, EmptyState, StatCard } from "@/components/ui";
import { aggregateReverseChargeByQuarter, type RcVoucher } from "@/lib/reverse-charge";
import { formatEur } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReverseChargePage() {
  const [rcVendors, rcVouchers] = await Promise.all([
    prisma.vendorRule.findMany({
      where: { reverseCharge: "ja" },
      include: { contact: true },
      orderBy: { contact: { name: "asc" } },
    }),
    prisma.voucher.findMany({
      where: { reverseCharge: "ja", reverseChargeBaseEurCents: { not: null } },
      select: { reverseCharge: true, reverseChargeBaseEurCents: true, reverseChargeVatRate: true, date: true },
    }),
  ]);

  const byQuarter = aggregateReverseChargeByQuarter(rcVouchers as unknown as RcVoucher[]);
  const quarters = Object.entries(byQuarter).sort(([a], [b]) => b.localeCompare(a));
  const totalBase = Object.values(byQuarter).reduce((s, q) => s + q.baseCents, 0);
  const totalVat = Object.values(byQuarter).reduce((s, q) => s + q.vatCents, 0);

  return (
    <div>
      <PageHeader
        title="§ 13b Reverse-Charge"
        subtitle="Kleinunternehmer § 19 befreit nicht von der Reverse-Charge-Schuld als Leistungsempfänger."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="§ 13b-Lieferanten" value={rcVendors.length} hint="bestätigt (ja)" />
        <StatCard label="Bemessungsgrundlage" value={formatEur(totalBase)} hint="Σ EUR-Basis" />
        <StatCard label="Geschuldete USt" value={formatEur(totalVat)} tone={totalVat > 0 ? "red" : "neutral"} hint="Σ über alle Quartale" />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Auswertung je Quartal</h2>
      {quarters.length === 0 ? (
        <EmptyState title="Noch keine § 13b-Belege.">
          Sobald ein Beleg eines § 13b-Lieferanten geprüft und (bei Fremdwährung) der EUR-Bankbetrag bestätigt ist, erscheint er hier —
          analog deiner heutigen <code>Reverse-Charge-Qx.xlsx</code>.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3 font-medium">Quartal</th>
                <th className="px-3 py-3 font-medium">Belege</th>
                <th className="px-3 py-3 font-medium">Bemessungsgrundlage</th>
                <th className="px-3 py-3 font-medium">Geschuldete USt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {quarters.map(([q, agg]) => (
                <tr key={q}>
                  <td className="px-4 py-2.5 font-medium">{q}</td>
                  <td className="px-3 py-2.5 tabular-nums">{agg.count}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatEur(agg.baseCents)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-red-700">{formatEur(agg.vatCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        § 13b-pflichtige Lieferanten ({rcVendors.length})
      </h2>
      <div className="flex flex-wrap gap-2">
        {rcVendors.map((v) => (
          <span key={v.id} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm">
            {v.contact.name}
            <Badge tone="neutral">{v.contact.countryCode ?? "?"}</Badge>
            {v.currency !== "EUR" && <Badge tone="blue">{v.currency}</Badge>}
          </span>
        ))}
      </div>
    </div>
  );
}
