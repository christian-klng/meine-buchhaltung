// Zentrale Ingest-Pipeline: Datei → Hash/Dedup → Ablage → Textlayer → Feld-Extraktion →
// Lieferanten-Matrix → Beleg-Vorschlag → Beleg + Positionen + Datei + Audit anlegen.
// Genutzt von der Upload-Server-Action und von Dev-Skripten (identischer Pfad).
import { prisma } from "./db";
import { hashBuffer, saveUpload } from "./storage";
import { extractPdfText } from "./pdf";
import { extractFields, matchVendor, type VendorPattern } from "./extraction";
import { buildProposal, type RuleInput } from "./apply-rule";

export interface IngestResult {
  voucherId: string;
  duplicate: boolean;
}

export async function ingestVoucher(buf: Buffer, originalName: string, mime: string): Promise<IngestResult> {
  const sha = hashBuffer(buf);
  const dupFile = await prisma.voucherFile.findFirst({ where: { sha256: sha }, select: { voucherId: true } });
  if (dupFile) return { voucherId: dupFile.voucherId, duplicate: true };

  const stored = await saveUpload(buf, originalName);
  const isPdf = mime === "application/pdf" || originalName.toLowerCase().endsWith(".pdf");

  let text = "";
  if (isPdf) {
    try {
      text = await extractPdfText(new Uint8Array(buf));
    } catch {
      text = "";
    }
  }
  const fields = extractFields(text);

  const contacts = await prisma.contact.findMany({ include: { vendorRule: true } });
  const patterns: VendorPattern[] = contacts.map((c) => ({
    contactId: c.id,
    name: c.name,
    matchStrings: c.matchStrings,
    matchDomains: c.matchDomains,
  }));
  const matched = fields.hasText ? matchVendor(text, patterns) : null;
  const matchedContact = matched ? contacts.find((c) => c.id === matched.contactId) ?? null : null;
  const vr = matchedContact?.vendorRule ?? null;
  const rule: RuleInput | null = vr
    ? {
        contactId: matchedContact!.id,
        defaultCategoryId: vr.defaultCategoryId,
        splitType: vr.splitType,
        businessPercent: vr.businessPercent,
        businessCategoryId: vr.businessCategoryId,
        privatCategoryId: vr.privatCategoryId,
        currency: vr.currency,
        reverseCharge: vr.reverseCharge,
        reverseChargeVatRate: vr.reverseChargeVatRate,
      }
    : null;

  const proposal = buildProposal(rule, {
    amountCents: fields.amountCents,
    currency: fields.currency,
    date: fields.date,
    voucherNumber: fields.voucherNumber,
  });

  const remarks: string[] = [];
  if (!fields.hasText) remarks.push("Kein Textlayer erkannt — bitte manuell erfassen");
  if (!proposal.date) remarks.push("Datum nicht erkannt");
  if (proposal.amountCents === 0) remarks.push("Betrag nicht erkannt");
  if (proposal.remark) remarks.push(proposal.remark);

  const created = await prisma.voucher.create({
    data: {
      date: proposal.date ?? new Date(),
      contactId: proposal.contactId,
      voucherNumber: proposal.voucherNumber,
      currency: proposal.currency,
      amountCents: proposal.amountCents,
      status: proposal.status,
      type: "purchaseinvoice",
      taxType: proposal.taxType,
      reverseCharge: proposal.reverseCharge,
      reverseChargeVatRate: proposal.reverseChargeVatRate,
      reverseChargeBaseEurCents: proposal.reverseChargeBaseEurCents,
      reverseChargeVatCents: proposal.reverseChargeVatCents,
      remark: remarks.length ? remarks.join(" · ") : null,
      items: { create: proposal.items.map((i) => ({ categoryId: i.categoryId, amountCents: i.amountCents, note: i.note ?? null })) },
      files: {
        create: {
          storagePath: stored.storagePath,
          originalName,
          mimeType: mime,
          sha256: stored.sha256,
          sizeBytes: stored.sizeBytes,
          extractedText: text || null,
        },
      },
      auditLogs: { create: { action: "create", actor: "upload", newValue: `status=${proposal.status}; vendor=${matchedContact?.name ?? "—"}` } },
    },
  });

  return { voucherId: created.id, duplicate: false };
}
