// § 13b Reverse-Charge (Plan Abschnitt 1/7). Kleinunternehmer § 19 befreit NICHT von der
// Reverse-Charge-Schuld als Leistungsempfänger. Nur bestätigte Fälle (`ja`) zählen in die Auswertung.

export type RcFlag = "ja" | "nein" | "pruefen";

/** Geschuldete USt in Cent = Bemessungsgrundlage × Satz, kaufmännisch gerundet. */
export function reverseChargeVatCents(baseCents: number, ratePercent: number): number {
  if (!Number.isInteger(baseCents)) throw new Error("baseCents muss ganzzahlig (Cent) sein");
  return Math.round((baseCents * ratePercent) / 100);
}

/** Nur `ja` (steuerberater-bestätigt) ist reverse-charge-pflichtig; `pruefen` zählt bewusst NICHT. */
export function isReverseChargeRelevant(flag: RcFlag): boolean {
  return flag === "ja";
}

export interface RcVoucher {
  reverseCharge: RcFlag;
  reverseChargeBaseEurCents: number | null;
  reverseChargeVatRate: number | null;
  date: Date;
}

export interface RcAggregate {
  count: number;
  baseCents: number;
  vatCents: number;
}

const DEFAULT_RATE = 19;

export function aggregateReverseCharge(vouchers: RcVoucher[]): RcAggregate {
  return vouchers
    .filter((v) => isReverseChargeRelevant(v.reverseCharge) && v.reverseChargeBaseEurCents != null)
    .reduce<RcAggregate>(
      (acc, v) => {
        const base = v.reverseChargeBaseEurCents as number;
        const vat = reverseChargeVatCents(base, v.reverseChargeVatRate ?? DEFAULT_RATE);
        return { count: acc.count + 1, baseCents: acc.baseCents + base, vatCents: acc.vatCents + vat };
      },
      { count: 0, baseCents: 0, vatCents: 0 },
    );
}

/** z. B. "2026-Q3" */
export function quarterOf(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${q}`;
}

/** § 13b-Auswertung je Quartal (analog Reverse-Charge-Qx.xlsx). */
export function aggregateReverseChargeByQuarter(vouchers: RcVoucher[]): Record<string, RcAggregate> {
  const out: Record<string, RcVoucher[]> = {};
  for (const v of vouchers) {
    const key = quarterOf(v.date);
    (out[key] ??= []).push(v);
  }
  const result: Record<string, RcAggregate> = {};
  for (const [key, group] of Object.entries(out)) {
    result[key] = aggregateReverseCharge(group);
  }
  return result;
}
