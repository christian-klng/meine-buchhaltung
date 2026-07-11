// Steuerliche Zone des Leistenden — die für § 13b relevante Unterscheidung.
// Werte spiegeln das Prisma-Enum `CountryZone` (siehe schema.prisma).

export const COUNTRY_ZONES = ["DE", "EU", "NON_EU"] as const;
export type CountryZone = (typeof COUNTRY_ZONES)[number];

export function isCountryZone(v: unknown): v is CountryZone {
  return typeof v === "string" && (COUNTRY_ZONES as readonly string[]).includes(v);
}

/** Kurzform für Tabellen/Badges. */
export const zoneShort: Record<CountryZone, string> = {
  DE: "DE",
  EU: "EU",
  NON_EU: "Nicht-EU",
};

/** Ausführliches Label für Dropdowns. */
export const zoneLabel: Record<CountryZone, string> = {
  DE: "Deutschland (Inland)",
  EU: "EU-Ausland",
  NON_EU: "Nicht-EU (Drittland)",
};
