// Fremdwährungs-Korrektur (Plan Abschnitt 2/6). Die OCR/Extraktion übernimmt Fremdwährung fälschlich
// 1:1 als EUR. Der echte EUR-Betrag steht erst nach der Bankabbuchung fest → bis dahin Status `awaiting_fx`.
// Diese Funktion wird NUR nach einem bestätigten Bankmatch angewandt (Hard Stop, kein stilles Überschreiben).

import { reverseChargeVatCents, type RcFlag } from "./reverse-charge";

export function isForeignCurrency(currency: string): boolean {
  return currency.trim().toUpperCase() !== "EUR";
}

export interface FxVoucherState {
  currency: string;
  amountCents: number; // aktueller (i. d. R. falscher 1:1) Betrag
  originalAmountCents: number | null;
  remark: string | null;
  reverseCharge: RcFlag;
  reverseChargeVatRate: number | null;
}

export interface FxPatch {
  amountCents: number;
  originalAmountCents: number;
  status: "unchecked";
  remark: string;
  reverseChargeBaseEurCents: number | null;
  reverseChargeVatCents: number | null;
  reverseChargeVatRate: number | null;
}

const DEFAULT_RATE = 19;
const BANK_NOTE = "EUR lt. Bankabbuchung";

/**
 * Übernimmt den tatsächlich abgebuchten EUR-Betrag (Cent) als führenden `amount`.
 * `bankAmountCents` darf vorzeichenbehaftet sein (Abbuchung negativ) — es wird der Betrag genommen.
 * Bei § 13b-Pflicht (`ja`) wird die Bemessungsgrundlage = dieser EUR-Betrag und die USt berechnet.
 */
export function applyBankEurAmount(v: FxVoucherState, bankAmountCents: number): FxPatch {
  const eur = Math.abs(bankAmountCents);
  const original = v.originalAmountCents ?? v.amountCents;
  const origNote = `Original ${(original / 100).toFixed(2)} ${v.currency.toUpperCase()}; ${BANK_NOTE}`;
  const remark = v.remark && !v.remark.includes(BANK_NOTE) ? `${v.remark} — ${origNote}` : origNote;

  const rcRelevant = v.reverseCharge === "ja";
  const rate = v.reverseChargeVatRate ?? DEFAULT_RATE;
  const rcBase = rcRelevant ? eur : null;
  const rcVat = rcBase != null ? reverseChargeVatCents(rcBase, rate) : null;

  return {
    amountCents: eur,
    originalAmountCents: original,
    status: "unchecked", // aus `awaiting_fx` heben — Mensch bestätigt final
    remark,
    reverseChargeBaseEurCents: rcBase,
    reverseChargeVatCents: rcVat,
    reverseChargeVatRate: rcRelevant ? rate : null,
  };
}
