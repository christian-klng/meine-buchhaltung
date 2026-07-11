"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { isCountryZone, type CountryZone } from "@/lib/country-zone";

export type ActionResult = { ok: true } | { ok: false; error: string };

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];
const RC_FLAGS = ["ja", "nein", "pruefen"] as const;
const SPLIT_TYPES = ["none", "split_70_30"] as const;

export interface VendorRulePayload {
  name: string;
  countryZone: CountryZone | null;
  defaultCategoryId: string | null;
  splitType: "none" | "split_70_30";
  businessPercent: number | null;
  businessCategoryId: string | null;
  privatCategoryId: string | null;
  currency: string;
  reverseCharge: "ja" | "nein" | "pruefen";
  reverseChargeVatRate: number;
}

/**
 * Speichert eine manuell bearbeitete Lieferanten-Regel (Matrix-Zeile).
 * Manuelle Änderungen sind ausdrücklich erlaubt – der `locked`-Flag schützt nur vor
 * Auto-Lernen, nicht vor dieser vom Nutzer angestoßenen Bearbeitung.
 */
export async function saveVendorRule(id: string, p: VendorRulePayload): Promise<ActionResult> {
  const rule = await prisma.vendorRule.findUnique({ where: { id } });
  if (!rule) return { ok: false, error: "Regel nicht gefunden." };

  const name = p.name.trim();
  if (!name) return { ok: false, error: "Lieferantenname fehlt." };
  if (p.countryZone !== null && !isCountryZone(p.countryZone)) return { ok: false, error: "Ungültige Zone." };
  if (!CURRENCIES.includes(p.currency)) return { ok: false, error: "Ungültige Währung." };
  if (!RC_FLAGS.includes(p.reverseCharge)) return { ok: false, error: "Ungültiger § 13b-Wert." };
  if (!SPLIT_TYPES.includes(p.splitType)) return { ok: false, error: "Ungültiger Split-Typ." };

  const isSplit = p.splitType === "split_70_30";
  if (isSplit) {
    if (!p.businessCategoryId || !p.privatCategoryId)
      return { ok: false, error: "Für den Split brauchst du eine Betriebs- und eine Privat-Kategorie." };
    if (p.businessPercent == null || !Number.isInteger(p.businessPercent) || p.businessPercent < 1 || p.businessPercent > 99)
      return { ok: false, error: "Betriebsanteil muss zwischen 1 und 99 % liegen." };
  }

  const rcRate = p.reverseCharge === "ja" ? p.reverseChargeVatRate : rule.reverseChargeVatRate;
  if (p.reverseCharge === "ja" && (!Number.isInteger(rcRate) || rcRate < 0 || rcRate > 100))
    return { ok: false, error: "USt-Satz muss zwischen 0 und 100 liegen." };

  try {
    await prisma.$transaction([
      prisma.contact.update({
        where: { id: rule.contactId },
        data: { name, countryZone: p.countryZone },
      }),
      prisma.vendorRule.update({
        where: { id },
        data: {
          defaultCategoryId: p.defaultCategoryId || null,
          splitType: p.splitType,
          businessPercent: isSplit ? p.businessPercent : null,
          businessCategoryId: isSplit ? p.businessCategoryId : null,
          privatCategoryId: isSplit ? p.privatCategoryId : null,
          currency: p.currency,
          reverseCharge: p.reverseCharge,
          reverseChargeVatRate: rcRate,
        },
      }),
    ]);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002")
      return { ok: false, error: `Ein Lieferant mit dem Namen „${name}“ existiert bereits.` };
    return { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." };
  }

  revalidatePath("/lieferanten");
  return { ok: true };
}
