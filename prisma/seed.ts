// Seed: Kategorien (mit Lexware-IDs) + Lieferanten-Matrix (Plan Abschnitt 5/7).
// Werte 1:1 aus dem beleg-pruefung-Skill — inkl. der Korrekturen aus dem Review
// (MILES = Mietwagen, OpenAI in USD-Liste, UMA Hub, St. Oberholz ohne Fixbetrag, kein Amazon→Bürobedarf).
// Alle Seed-Regeln sind `locked` (nicht durch Auto-Lernen überschreibbar). Idempotent (upserts).
import "dotenv/config";
import { prisma } from "../src/lib/db";
import type { CountryZone } from "../src/lib/country-zone";

// ── Kategorien (Name → Lexware-GUID; null = ID noch nicht verifiziert) ──
const CATEGORIES: { name: string; lexwareCategoryId: string | null }[] = [
  { name: "Miete/Pacht", lexwareCategoryId: "ccbd1972-fd88-11e1-a21f-0800200c9a66" },
  { name: "Festnetz", lexwareCategoryId: "b3a1f840-fd90-11e1-a21f-0800200c9a66" },
  { name: "Mobil", lexwareCategoryId: "b3a1f842-fd90-11e1-a21f-0800200c9a66" },
  { name: "Internet", lexwareCategoryId: "b3a1f841-fd90-11e1-a21f-0800200c9a66" },
  { name: "Privatentnahmen", lexwareCategoryId: "16d04a25-fd91-11e1-a21f-0800200c9a66" },
  { name: "Bahn-/Flugticket, Mietwagen", lexwareCategoryId: "f9f05690-fd89-11e1-a21f-0800200c9a66" },
  { name: "Fremdfahrzeuge", lexwareCategoryId: "9eaf6ff4-fd89-11e1-a21f-0800200c9a66" },
  { name: "Seminar/Weiterbildung", lexwareCategoryId: "16d04a27-fd91-11e1-a21f-0800200c9a66" },
  { name: "Sonstige Ausgaben", lexwareCategoryId: "16d04a28-fd91-11e1-a21f-0800200c9a66" },
  { name: "Bürobedarf", lexwareCategoryId: null }, // ID per GET /v1/posting-categories verifizieren
];

type Split = { businessPercent: number; businessCategory: string; privatCategory: string };
interface VendorSeed {
  name: string;
  countryZone: CountryZone; // steuerliche Zone des Leistenden (Inland/EU/Drittland)
  currency: "EUR" | "USD";
  reverseCharge: "ja" | "nein" | "pruefen";
  reverseChargeVatRate?: number;
  defaultCategory?: string | null;
  split?: Split;
  matchStrings?: string[];
  matchDomains?: string[];
  lexwareId?: string;
}

// ── Lieferanten-Matrix ──
const VENDORS: VendorSeed[] = [
  // Inländisch (DE), kein Reverse-Charge
  { name: "St. Oberholz Coffee GmbH", countryZone: "DE", currency: "EUR", reverseCharge: "nein", defaultCategory: "Miete/Pacht", matchStrings: ["oberholz"], lexwareId: "500e1b68-9a7c-43f4-9556-61e6f2d10ab6" },
  { name: "UMA Hub GmbH", countryZone: "DE", currency: "EUR", reverseCharge: "nein", defaultCategory: "Miete/Pacht", matchStrings: ["uma hub"] },
  { name: "Telekom Deutschland GmbH", countryZone: "DE", currency: "EUR", reverseCharge: "nein", split: { businessPercent: 70, businessCategory: "Mobil", privatCategory: "Privatentnahmen" }, matchStrings: ["telekom"], matchDomains: ["telekom.de"], lexwareId: "37d0a1fa-d854-4393-847f-b014e0695ebc" },
  { name: "Maingau Energie GmbH", countryZone: "DE", currency: "EUR", reverseCharge: "nein", split: { businessPercent: 70, businessCategory: "Festnetz", privatCategory: "Privatentnahmen" }, matchStrings: ["maingau"], lexwareId: "b97f40bf-719d-4950-a2f7-c0d8f4c9f33a" },
  { name: "DB Fernverkehr AG", countryZone: "DE", currency: "EUR", reverseCharge: "nein", defaultCategory: "Bahn-/Flugticket, Mietwagen", matchStrings: ["db fernverkehr", "bahn"], lexwareId: "4bbd43ad-974c-4b94-9322-8a8735fb782f" },
  // MILES = Mietwagen (Bahn-/Flugticket, Mietwagen), AUSDRÜCKLICH NICHT Fremdfahrzeuge (Review A2)
  { name: "MILES Mobility GmbH", countryZone: "DE", currency: "EUR", reverseCharge: "nein", defaultCategory: "Bahn-/Flugticket, Mietwagen", matchStrings: ["miles"], lexwareId: "63d245b9-b9cc-4e3e-a8de-1786fc183a70" },
  { name: "IONOS SE", countryZone: "DE", currency: "EUR", reverseCharge: "nein", defaultCategory: "Internet", matchStrings: ["ionos"], matchDomains: ["ionos.de", "ionos.com"] },
  { name: "United-Domains GmbH", countryZone: "DE", currency: "EUR", reverseCharge: "nein", defaultCategory: "Internet", matchStrings: ["united-domains", "united domains"], matchDomains: ["united-domains.de"], lexwareId: "fe65d7c8-a388-4104-8747-270d6e636cdb" },
  { name: "Alfahosting GmbH", countryZone: "DE", currency: "EUR", reverseCharge: "nein", defaultCategory: "Internet", matchStrings: ["alfahosting"], lexwareId: "15ab04d9-7342-424d-a3fa-a7128040c89e" },
  { name: "Lunaweb GmbH", countryZone: "DE", currency: "EUR", reverseCharge: "nein", defaultCategory: "Internet", matchStrings: ["lunaweb"] },
  { name: "Hetzner Online GmbH", countryZone: "DE", currency: "EUR", reverseCharge: "nein", defaultCategory: "Internet", matchStrings: ["hetzner"], matchDomains: ["hetzner.com", "hetzner.de"] },

  // EU-Ausland, § 13b bestätigt (StB), Abrechnung in EUR
  { name: "AI Builders", countryZone: "EU", currency: "EUR", reverseCharge: "ja", defaultCategory: "Seminar/Weiterbildung", matchStrings: ["ai builders"] },
  { name: "Cortecs GmbH", countryZone: "EU", currency: "EUR", reverseCharge: "ja", defaultCategory: null, matchStrings: ["cortecs"] },
  { name: "Google Cloud EMEA", countryZone: "EU", currency: "EUR", reverseCharge: "ja", defaultCategory: null, matchStrings: ["google cloud"], matchDomains: ["google.com"] },
  { name: "Adobe", countryZone: "EU", currency: "EUR", reverseCharge: "ja", defaultCategory: null, matchStrings: ["adobe"], matchDomains: ["adobe.com"] },
  { name: "Amazon EU", countryZone: "EU", currency: "EUR", reverseCharge: "ja", defaultCategory: null, matchStrings: ["amazon"], matchDomains: ["amazon.de", "amazon.com"] },
  // Paddle/n8n: Sitz UK → nach Brexit Drittland (Nicht-EU)
  { name: "Paddle (n8n)", countryZone: "NON_EU", currency: "EUR", reverseCharge: "ja", defaultCategory: null, matchStrings: ["paddle", "n8n"] },
  { name: "GoDaddy", countryZone: "NON_EU", currency: "EUR", reverseCharge: "ja", defaultCategory: null, matchStrings: ["godaddy"], matchDomains: ["godaddy.com"] },
  { name: "Anthropic", countryZone: "NON_EU", currency: "EUR", reverseCharge: "ja", defaultCategory: null, matchStrings: ["anthropic"], matchDomains: ["anthropic.com"] },

  // Ausland, § 13b bestätigt, Abrechnung in USD (Fremdwährungs-Hard-Stop)
  { name: "Unipile", countryZone: "EU", currency: "USD", reverseCharge: "ja", defaultCategory: null, matchStrings: ["unipile"], matchDomains: ["unipile.com"] },
  { name: "OpenAI", countryZone: "NON_EU", currency: "USD", reverseCharge: "ja", defaultCategory: null, matchStrings: ["openai"], matchDomains: ["openai.com"] },
  { name: "Railway", countryZone: "NON_EU", currency: "USD", reverseCharge: "ja", defaultCategory: "Internet", matchStrings: ["railway"], matchDomains: ["railway.app", "railway.com"] },
  { name: "ElevenLabs", countryZone: "NON_EU", currency: "USD", reverseCharge: "ja", defaultCategory: null, matchStrings: ["eleven labs", "elevenlabs"], matchDomains: ["elevenlabs.io"] },
  { name: "Northflank", countryZone: "NON_EU", currency: "USD", reverseCharge: "ja", defaultCategory: "Internet", matchStrings: ["northflank"], matchDomains: ["northflank.com"] },
  { name: "OpenRouter", countryZone: "NON_EU", currency: "USD", reverseCharge: "ja", defaultCategory: null, matchStrings: ["openrouter"], matchDomains: ["openrouter.ai"] },
  { name: "Replicate", countryZone: "NON_EU", currency: "USD", reverseCharge: "ja", defaultCategory: null, matchStrings: ["replicate"], matchDomains: ["replicate.com"] },
  { name: "Fal (Features & Labels)", countryZone: "NON_EU", currency: "USD", reverseCharge: "ja", defaultCategory: null, matchStrings: ["fal.ai", "features & labels"], matchDomains: ["fal.ai"] },
];

async function main() {
  // Idempotenz-Schutz: nur seeden, wenn die DB noch leer ist (überschreibt keine späteren UI-Anpassungen).
  // Mit FORCE_SEED=1 lässt sich der Seed erzwingen (aktualisiert die gelockten Seed-Regeln).
  const existing = await prisma.category.count();
  if (existing > 0 && !process.env.FORCE_SEED) {
    console.log(`Seed übersprungen — bereits ${existing} Kategorien vorhanden (FORCE_SEED=1 zum Erzwingen).`);
    return;
  }

  // Kategorien
  const categoryIdByName = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { name: c.name },
      update: { lexwareCategoryId: c.lexwareCategoryId },
      create: { name: c.name, lexwareCategoryId: c.lexwareCategoryId, kind: "outgo" },
    });
    categoryIdByName.set(c.name, row.id);
  }
  console.log(`✓ ${CATEGORIES.length} Kategorien`);

  // Lieferanten + Matrix-Regeln
  for (const v of VENDORS) {
    const contact = await prisma.contact.upsert({
      where: { name: v.name },
      update: { countryZone: v.countryZone, matchStrings: v.matchStrings ?? [], matchDomains: v.matchDomains ?? [], lexwareId: v.lexwareId ?? null },
      create: { name: v.name, countryZone: v.countryZone, role: "vendor", matchStrings: v.matchStrings ?? [], matchDomains: v.matchDomains ?? [], lexwareId: v.lexwareId ?? null },
    });

    const defaultCategoryId = v.defaultCategory ? categoryIdByName.get(v.defaultCategory) ?? null : null;
    const rule = {
      defaultCategoryId,
      splitType: v.split ? ("split_70_30" as const) : ("none" as const),
      businessPercent: v.split?.businessPercent ?? null,
      businessCategoryId: v.split ? categoryIdByName.get(v.split.businessCategory) ?? null : null,
      privatCategoryId: v.split ? categoryIdByName.get(v.split.privatCategory) ?? null : null,
      currency: v.currency,
      reverseCharge: v.reverseCharge,
      reverseChargeVatRate: v.reverseChargeVatRate ?? 19,
      locked: true,
    };
    await prisma.vendorRule.upsert({
      where: { contactId: contact.id },
      update: rule,
      create: { contactId: contact.id, ...rule },
    });
  }
  console.log(`✓ ${VENDORS.length} Lieferanten-Regeln`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
