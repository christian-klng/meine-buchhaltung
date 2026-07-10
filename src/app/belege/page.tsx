import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Badge, EmptyState } from "@/components/ui";
import { formatEur, formatDate } from "@/lib/format";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "amber" | "blue" | "green" }> = {
  draft: { label: "Entwurf", tone: "neutral" },
  unchecked: { label: "Zu prüfen", tone: "amber" },
  awaiting_fx: { label: "Wartet auf EUR", tone: "blue" },
  checked: { label: "Geprüft", tone: "green" },
};

export default async function BelegePage() {
  const vouchers = await prisma.voucher.findMany({
    include: { contact: true },
    orderBy: [{ date: "desc" }, { id: "asc" }],
    take: 100,
  });

  return (
    <div>
      <PageHeader title="Belege" subtitle="PDF/Bild hochladen → programmatische Extraktion → Prüf-Ansicht → Bestätigung." />

      <UploadForm />

      {vouchers.length === 0 ? (
        <EmptyState title="Noch keine Belege.">
          Lade oben einen Beleg hoch: PDF mit Textlayer wird automatisch ausgelesen, die Lieferanten-Matrix belegt Kategorie/Split/Währung/§
          13b vor. Fremdwährungsbelege gehen zuerst in den Wartestatus <Badge tone="blue">awaiting_fx</Badge>, bis der EUR-Bankbetrag
          feststeht.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3 font-medium">Datum</th>
                <th className="px-3 py-3 font-medium">Lieferant</th>
                <th className="px-3 py-3 font-medium">Beleg-Nr.</th>
                <th className="px-3 py-3 font-medium text-right">Betrag</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {vouchers.map((v) => {
                const s = STATUS_LABEL[v.status] ?? { label: v.status, tone: "neutral" as const };
                return (
                  <tr key={v.id} className="cursor-pointer hover:bg-neutral-50">
                    <td className="px-4 py-2.5 tabular-nums text-neutral-600">
                      <Link href={`/belege/${v.id}`} className="block">
                        {formatDate(v.date)}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      <Link href={`/belege/${v.id}`} className="block hover:underline">
                        {v.contact?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-500">{v.voucherNumber ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatEur(v.amountCents)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
