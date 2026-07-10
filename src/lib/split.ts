// Split-Logik mit Summen-Invariante (Plan Abschnitt 6/7, kanonische Formel aus dem beleg-pruefung-Skill).
// Betriebsanteil wird gerundet, Privatanteil = Brutto − Betrieb — so stimmt die Summe IMMER exakt.

export interface SplitResult {
  businessCents: number;
  privatCents: number;
}

export function splitByPercent(grossCents: number, businessPercent: number): SplitResult {
  if (!Number.isInteger(grossCents)) throw new Error("grossCents muss ganzzahlig (Cent) sein");
  if (businessPercent < 0 || businessPercent > 100) throw new Error("businessPercent muss zwischen 0 und 100 liegen");
  const businessCents = Math.round((grossCents * businessPercent) / 100);
  return { businessCents, privatCents: grossCents - businessCents };
}

/** 70 % Betrieb / 30 % Privatentnahme — Telekom/Maingau. */
export function split70_30(grossCents: number): SplitResult {
  return splitByPercent(grossCents, 70);
}

/** Prüft die Summen-Invariante: Positionssumme (Cent) === Brutto (Cent). */
export function sumEqualsGross(partsCents: number[], grossCents: number): boolean {
  return partsCents.reduce((a, b) => a + b, 0) === grossCents;
}
