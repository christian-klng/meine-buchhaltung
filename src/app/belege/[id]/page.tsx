import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ReviewForm } from "./review-form";
import { Badge } from "@/components/ui";
import { formatAmount } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "neutral" | "amber" | "blue" | "green" }> = {
  draft: { label: "Entwurf", tone: "neutral" },
  unchecked: { label: "Zu prüfen", tone: "amber" },
  awaiting_fx: { label: "Wartet auf EUR", tone: "blue" },
  checked: { label: "Geprüft", tone: "green" },
};

export default async function VoucherDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dup?: string }>;
}) {
  const { id } = await params;
  const { dup } = await searchParams;

  const voucher = await prisma.voucher.findUnique({
    where: { id },
    include: { items: true, files: true, contact: true },
  });
  if (!voucher) notFound();

  const [categories, contacts] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const file = voucher.files[0];
  const isImage = file?.mimeType?.startsWith("image/") ?? false;
  const s = STATUS[voucher.status] ?? { label: voucher.status, tone: "neutral" as const };

  return (
    <div>
      <Link href="/belege" className="text-sm text-neutral-500 hover:underline">
        ← Belege
      </Link>
      <div className="mb-1 mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{voucher.contact?.name ?? "Unbekannter Lieferant"}</h1>
        <div className="flex items-center gap-2">
          {voucher.originalAmountCents != null && (
            <Badge tone="neutral">Original {formatAmount(voucher.originalAmountCents, "USD")}</Badge>
          )}
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
      </div>

      {dup && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          Diese Datei wurde bereits hochgeladen — hier ist der vorhandene Beleg.
        </div>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {/* Original */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-100 p-2">
          {file ? (
            isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${file.id}`} alt={file.originalName ?? "Beleg"} className="mx-auto max-h-[70vh] w-auto rounded" />
            ) : (
              <iframe src={`/api/files/${file.id}`} className="h-[70vh] w-full rounded bg-white" title="Original-Beleg" />
            )
          ) : (
            <p className="p-8 text-center text-sm text-neutral-400">Keine Datei</p>
          )}
        </div>

        {/* Prüf-Formular */}
        <div>
          <ReviewForm
            voucher={{
              id: voucher.id,
              dateISO: voucher.date.toISOString().slice(0, 10),
              voucherNumber: voucher.voucherNumber,
              amountCents: voucher.amountCents,
              currency: voucher.currency,
              contactId: voucher.contactId,
              status: voucher.status,
              reverseCharge: voucher.reverseCharge,
              reverseChargeVatRate: voucher.reverseChargeVatRate,
              paidPrivately: voucher.paidPrivately,
              remark: voucher.remark,
              originalAmountCents: voucher.originalAmountCents,
              items: voucher.items.map((i) => ({ categoryId: i.categoryId, amountCents: i.amountCents, note: i.note })),
            }}
            categories={categories}
            contacts={contacts}
          />
        </div>
      </div>
    </div>
  );
}
