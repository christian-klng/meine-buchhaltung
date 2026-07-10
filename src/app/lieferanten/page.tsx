import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

function RcBadge({ flag }: { flag: "ja" | "nein" | "pruefen" }) {
  if (flag === "ja") return <Badge tone="red">Ja</Badge>;
  if (flag === "pruefen") return <Badge tone="amber">Prüfen</Badge>;
  return <Badge tone="neutral">Nein</Badge>;
}

export default async function LieferantenPage() {
  const rules = await prisma.vendorRule.findMany({
    include: { contact: true, defaultCategory: true, businessCategory: true, privatCategory: true },
    orderBy: [{ reverseCharge: "asc" }, { contact: { name: "asc" } }],
  });

  return (
    <div>
      <PageHeader
        title="Lieferanten-Matrix"
        subtitle={`${rules.length} Regeln. Kategorie, Split-Logik, Währung und § 13b je Lieferant — vorbelegt, von dir editierbar.`}
      />

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3 font-medium">Lieferant</th>
              <th className="px-3 py-3 font-medium">Land</th>
              <th className="px-3 py-3 font-medium">Kategorie</th>
              <th className="px-3 py-3 font-medium">Split</th>
              <th className="px-3 py-3 font-medium">Währung</th>
              <th className="px-3 py-3 font-medium">§ 13b</th>
              <th className="px-3 py-3 font-medium">Satz</th>
              <th className="px-3 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rules.map((r) => {
              const split =
                r.splitType === "split_70_30" && r.businessCategory && r.privatCategory
                  ? `${r.businessPercent ?? 70}% ${r.businessCategory.name} / ${100 - (r.businessPercent ?? 70)}% ${r.privatCategory.name}`
                  : null;
              return (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 font-medium text-neutral-900">{r.contact.name}</td>
                  <td className="px-3 py-2.5 text-neutral-500">{r.contact.countryCode ?? "–"}</td>
                  <td className="px-3 py-2.5 text-neutral-700">
                    {r.defaultCategory?.name ?? <span className="text-neutral-400 italic">von dir</span>}
                  </td>
                  <td className="px-3 py-2.5 text-neutral-700">{split ?? <span className="text-neutral-400">–</span>}</td>
                  <td className="px-3 py-2.5">
                    {r.currency === "EUR" ? (
                      <span className="text-neutral-600">EUR</span>
                    ) : (
                      <Badge tone="blue">{r.currency}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <RcBadge flag={r.reverseCharge} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-neutral-600">{r.reverseCharge === "ja" ? `${r.reverseChargeVatRate} %` : "–"}</td>
                  <td className="px-3 py-2.5">{r.locked && <Badge tone="neutral">🔒 Seed</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        Währung und § 13b sind unabhängig: EUR-Abrechnung schließt Reverse-Charge nicht aus. „Prüfen" zählt bewusst nicht in die
        Auswertung, bis der Steuerberater bestätigt.
      </p>
    </div>
  );
}
