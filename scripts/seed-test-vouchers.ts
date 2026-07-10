// Dev-Fixture: erzeugt echte Test-PDFs und schickt sie durch die Ingest-Pipeline.
// Aufruf: npx tsx scripts/seed-test-vouchers.ts
import "dotenv/config";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { ingestVoucher } from "../src/lib/ingest";
import { prisma } from "../src/lib/db";

async function makePdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 800;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 18;
  }
  return Buffer.from(await doc.save());
}

async function main() {
  const telekom = await makePdf([
    "Telekom Deutschland GmbH",
    "Rechnung",
    "Rechnungsnummer: 7646598285",
    "Rechnungsdatum: 13.03.2026",
    "Mobilfunk-Grundgebuehr 21,85",
    "Zwischensumme 21,85",
    "Gesamtbetrag 26,00 EUR",
    "Faellig 31.03.2026",
  ]);
  const unipile = await makePdf([
    "UNIPILE",
    "Invoice",
    "Invoice number: INV-2026-0042",
    "Date: 2026-05-10",
    "Subtotal: $48.18",
    "Total due: $48.18 USD",
  ]);

  const r1 = await ingestVoucher(telekom, "telekom-2026-03.pdf", "application/pdf");
  const r2 = await ingestVoucher(unipile, "unipile-2026-05.pdf", "application/pdf");
  console.log("Telekom (EUR, Split):", r1);
  console.log("Unipile (USD, awaiting_fx):", r2);

  for (const id of [r1.voucherId, r2.voucherId]) {
    const v = await prisma.voucher.findUnique({ where: { id }, include: { items: { include: { category: true } }, contact: true } });
    console.log(
      `  → ${v?.contact?.name}: ${v?.status} | ${(v!.amountCents / 100).toFixed(2)} ${v?.currency} | §13b=${v?.reverseCharge} | Nr=${v?.voucherNumber} | items=${v?.items.map((i) => `${i.category.name}:${(i.amountCents / 100).toFixed(2)}`).join(", ") || "—"}`,
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
