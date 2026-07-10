// Reproduzierbarer Demo-Datenstand: Reset → 2 Belege (Telekom EUR-Split, Unipile USD→awaiting_fx)
// → camt-Auszug mit 3 Abbuchungen (Telekom, Unipile, eine beleglose). Aufruf: npx tsx scripts/seed-demo.ts
import "dotenv/config";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { ingestVoucher } from "../src/lib/ingest";
import { importBankFile } from "../src/lib/bank/import";
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

const CAMT = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.052.001.02">
 <BkToCstmrAcctRpt><Rpt>
  <Acct><Id><IBAN>DE00123456780000000000</IBAN></Id></Acct>
  <Ntry><Amt Ccy="EUR">26.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-03-16</Dt></BookgDt>
    <NtryDtls><TxDtls><RltdPties><Cdtr><Nm>Telekom Deutschland GmbH</Nm></Cdtr></RltdPties><RmtInf><Ustrd>Rechnung 7646598285</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
  <Ntry><Amt Ccy="EUR">44.50</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-05-13</Dt></BookgDt>
    <NtryDtls><TxDtls><RltdPties><Cdtr><Nm>Unipile SAS</Nm></Cdtr></RltdPties><RmtInf><Ustrd>Invoice INV-2026-0042</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
  <Ntry><Amt Ccy="EUR">99.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-04-02</Dt></BookgDt>
    <NtryDtls><TxDtls><RltdPties><Cdtr><Nm>Fremdanbieter XY GmbH</Nm></Cdtr></RltdPties><RmtInf><Ustrd>Abo April</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
 </Rpt></BkToCstmrAcctRpt></Document>`;

async function main() {
  // Reset (nur Belege/Bank — Stammdaten/Matrix bleiben)
  await prisma.reconciliationLink.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.voucherItem.deleteMany();
  await prisma.voucherFile.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.bankStatement.deleteMany();

  const telekom = await makePdf([
    "Telekom Deutschland GmbH",
    "Rechnung",
    "Rechnungsnummer: 7646598285",
    "Rechnungsdatum: 13.03.2026",
    "Mobilfunk-Grundgebuehr 21,85",
    "Zwischensumme 21,85",
    "Gesamtbetrag 26,00 EUR",
  ]);
  const unipile = await makePdf([
    "UNIPILE",
    "Invoice number: INV-2026-0042",
    "Date: 2026-05-10",
    "Total due: $48.18 USD",
  ]);
  await ingestVoucher(telekom, "telekom-2026-03.pdf", "application/pdf");
  await ingestVoucher(unipile, "unipile-2026-05.pdf", "application/pdf");

  const imp = await importBankFile(Buffer.from(CAMT, "utf8"), "holvi-2026.xml");
  console.log("Bank-Import:", imp);

  const vs = await prisma.voucher.findMany({ include: { contact: true } });
  for (const v of vs) console.log(`  Beleg ${v.contact?.name}: ${v.status} | ${(v.amountCents / 100).toFixed(2)} ${v.currency}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
