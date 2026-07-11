import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { LieferantenMatrix, type RuleRow } from "./matrix";

export const dynamic = "force-dynamic";

export default async function LieferantenPage() {
  const [rules, categories] = await Promise.all([
    prisma.vendorRule.findMany({
      include: { contact: true },
      orderBy: [{ reverseCharge: "asc" }, { contact: { name: "asc" } }],
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: RuleRow[] = rules.map((r) => ({
    id: r.id,
    contactName: r.contact.name,
    countryZone: r.contact.countryZone,
    defaultCategoryId: r.defaultCategoryId,
    splitType: r.splitType,
    businessPercent: r.businessPercent,
    businessCategoryId: r.businessCategoryId,
    privatCategoryId: r.privatCategoryId,
    currency: r.currency,
    reverseCharge: r.reverseCharge,
    reverseChargeVatRate: r.reverseChargeVatRate,
    matchStrings: r.contact.matchStrings,
    matchDomains: r.contact.matchDomains,
    locked: r.locked,
  }));

  return (
    <div>
      <PageHeader
        title="Lieferanten"
        subtitle={`${rows.length} Regeln. Kategorie, Split-Logik, Währung und § 13b je Lieferant — vorbelegt, über das Stift-Icon editierbar.`}
      />

      <LieferantenMatrix rows={rows} categories={categories} />

      <p className="mt-4 text-xs text-neutral-400">
        Währung und § 13b sind unabhängig: EUR-Abrechnung schließt Reverse-Charge nicht aus. „Prüfen“ zählt bewusst nicht in die
        Auswertung, bis der Steuerberater bestätigt.
      </p>
    </div>
  );
}
