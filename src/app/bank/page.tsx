import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Badge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { BankUploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export default async function BankPage() {
  const statements = await prisma.bankStatement.findMany({
    include: { _count: { select: { transactions: true } } },
    orderBy: { importedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Bank-Import"
        subtitle="Kontoauszug importieren (camt.052/053 oder CSV) — danach geht es zum Abgleich."
        action={
          <Link href="/abgleich" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50">
            Zum Abgleich →
          </Link>
        }
      />

      <BankUploadForm />

      {statements.length === 0 ? (
        <EmptyState title="Noch kein Auszug importiert.">
          Lade einen camt-XML- oder CSV-Export aus deinem Banking-Portal hoch. Die Buchungen werden normalisiert und anschließend
          automatisch den Belegen zugeordnet.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3 font-medium">Importiert</th>
                <th className="px-3 py-3 font-medium">Datei</th>
                <th className="px-3 py-3 font-medium">Format</th>
                <th className="px-3 py-3 font-medium">Zeitraum</th>
                <th className="px-3 py-3 font-medium text-right">Buchungen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {statements.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 tabular-nums text-neutral-600">{formatDate(s.importedAt)}</td>
                  <td className="px-3 py-2.5">{s.fileName ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone="neutral">{s.format}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-500">
                    {s.periodStart ? `${formatDate(s.periodStart)}–${s.periodEnd ? formatDate(s.periodEnd) : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s._count.transactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
