import { prisma } from "@/lib/db";
import { StatCard, PageHeader, EmptyState } from "@/components/ui";
import { aggregateReverseChargeByQuarter, type RcVoucher } from "@/lib/reverse-charge";
import { formatEur } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [unchecked, awaitingFx, checked, ruleCount, categoryCount, rcVendorCount, rcVouchers] = await Promise.all([
    prisma.voucher.count({ where: { status: "unchecked" } }),
    prisma.voucher.count({ where: { status: "awaiting_fx" } }),
    prisma.voucher.count({ where: { status: "checked" } }),
    prisma.vendorRule.count(),
    prisma.category.count(),
    prisma.vendorRule.count({ where: { reverseCharge: "ja" } }),
    prisma.voucher.findMany({
      where: { reverseCharge: "ja", reverseChargeBaseEurCents: { not: null } },
      select: { reverseCharge: true, reverseChargeBaseEurCents: true, reverseChargeVatRate: true, date: true },
    }),
  ]);

  const rcByQuarter = aggregateReverseChargeByQuarter(rcVouchers as unknown as RcVoucher[]);
  const rcTotalVat = Object.values(rcByQuarter).reduce((s, q) => s + q.vatCents, 0);
  const totalVouchers = unchecked + awaitingFx + checked;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Überblick über offene Belege, Fremdwährung und § 13b." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Zu prüfen" value={unchecked} tone={unchecked > 0 ? "amber" : "neutral"} hint="Status: unchecked" />
        <StatCard label="Wartet auf EUR" value={awaitingFx} tone={awaitingFx > 0 ? "blue" : "neutral"} hint="Fremdwährung (awaiting_fx)" />
        <StatCard label="Geprüft" value={checked} tone="green" hint="Status: checked" />
        <StatCard label="Lieferanten-Regeln" value={ruleCount} hint={`davon § 13b: ${rcVendorCount}`} />
        <StatCard label="Kategorien" value={categoryCount} hint="Seed aus Lexware-IDs" />
        <StatCard label="§ 13b USt (offen)" value={formatEur(rcTotalVat)} tone={rcTotalVat > 0 ? "red" : "neutral"} hint="Σ geschuldete USt" />
      </div>

      <div className="mt-8">
        {totalVouchers === 0 ? (
          <EmptyState title="Noch keine Belege erfasst.">
            Die Stammdaten stehen: <strong>{ruleCount} Lieferanten-Regeln</strong> und <strong>{categoryCount} Kategorien</strong> sind
            {" "}geladen. Als Nächstes folgen Upload &amp; Extraktion. Die{" "}
            <Link href="/lieferanten" className="text-blue-600 underline">
              Lieferanten-Matrix
            </Link>{" "}
            kannst du schon jetzt ansehen.
          </EmptyState>
        ) : (
          <Link href="/belege" className="text-sm text-blue-600 underline">
            {totalVouchers} Belege ansehen →
          </Link>
        )}
      </div>
    </div>
  );
}
