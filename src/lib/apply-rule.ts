// Baut aus erkannter VendorRule + extrahierten Feldern einen Beleg-Vorschlag (Plan Abschnitt 6, Schritt 4/5).
// Rein & testbar. Kernentscheidungen: Fremdwährung → Status awaiting_fx, keine Positionen/§13b-Basis bis Bankabgleich.
import { splitByPercent } from "./split";
import { reverseChargeVatCents, type RcFlag } from "./reverse-charge";

export interface RuleInput {
  contactId: string;
  defaultCategoryId: string | null;
  splitType: "none" | "split_70_30";
  businessPercent: number | null;
  businessCategoryId: string | null;
  privatCategoryId: string | null;
  currency: string;
  reverseCharge: RcFlag;
  reverseChargeVatRate: number;
}

export interface ExtractInput {
  amountCents: number | null;
  currency: string;
  date: Date | null;
  voucherNumber: string | null;
}

export interface ProposalItem {
  categoryId: string;
  amountCents: number;
  note?: string;
}

export interface VoucherProposal {
  contactId: string | null;
  currency: string;
  amountCents: number;
  status: "unchecked" | "awaiting_fx";
  taxType: "vatfree" | "reverse_charge";
  reverseCharge: RcFlag;
  reverseChargeVatRate: number | null;
  reverseChargeBaseEurCents: number | null;
  reverseChargeVatCents: number | null;
  voucherNumber: string | null;
  date: Date | null;
  items: ProposalItem[];
  remark: string | null;
}

export function buildProposal(rule: RuleInput | null, ex: ExtractInput): VoucherProposal {
  const currency = (rule?.currency ?? ex.currency ?? "EUR").toUpperCase();
  const isFx = currency !== "EUR";
  const amountCents = ex.amountCents ?? 0;
  const rc: RcFlag = rule?.reverseCharge ?? "nein";
  const status: "unchecked" | "awaiting_fx" = isFx ? "awaiting_fx" : "unchecked";

  // Positionen nur bei verlässlichem EUR-Betrag und bekannter Kategorie.
  // Bei Fremdwährung ist der Betrag noch der falsche 1:1-Wert → keine Positionen bis zur Bankkorrektur.
  const items: ProposalItem[] = [];
  if (!isFx && amountCents > 0 && rule) {
    if (rule.splitType === "split_70_30" && rule.businessCategoryId && rule.privatCategoryId) {
      const pct = rule.businessPercent ?? 70;
      const { businessCents, privatCents } = splitByPercent(amountCents, pct);
      items.push({ categoryId: rule.businessCategoryId, amountCents: businessCents, note: "Betrieb" });
      items.push({ categoryId: rule.privatCategoryId, amountCents: privatCents, note: "Privatentnahme" });
    } else if (rule.defaultCategoryId) {
      items.push({ categoryId: rule.defaultCategoryId, amountCents });
    }
  }

  // § 13b: Basis/USt nur wenn EUR-Betrag feststeht; bei awaiting_fx erst nach Bankkorrektur.
  const rcActive = rc === "ja";
  const rate = rule?.reverseChargeVatRate ?? 19;
  const rcBase = rcActive && !isFx && amountCents > 0 ? amountCents : null;
  const rcVat = rcBase != null ? reverseChargeVatCents(rcBase, rate) : null;

  return {
    contactId: rule?.contactId ?? null,
    currency,
    amountCents,
    status,
    taxType: rcActive ? "reverse_charge" : "vatfree",
    reverseCharge: rc,
    reverseChargeVatRate: rcActive ? rate : null,
    reverseChargeBaseEurCents: rcBase,
    reverseChargeVatCents: rcVat,
    voucherNumber: ex.voucherNumber,
    date: ex.date,
    items,
    remark: isFx ? `Fremdwährung ${currency} — EUR-Betrag steht erst nach Bankabgleich fest` : null,
  };
}
