-- Ersetzt das Freitextfeld Contact.countryCode durch die steuerliche Zone Contact.countryZone
-- (Inland / EU / Drittland) — die einzige für § 13b relevante Unterscheidung.

-- CreateEnum
CREATE TYPE "CountryZone" AS ENUM ('DE', 'EU', 'NON_EU');

-- Neue Spalte (nullable, kein Default: unbekannte Zone bleibt bewusst leer)
ALTER TABLE "Contact" ADD COLUMN "countryZone" "CountryZone";

-- Backfill aus dem bisherigen ISO-Kürzel.
-- EU-Mitgliedstaaten (Stand 2026, ohne GB nach Brexit). EL = Griechenland (Amtscode), GR = ISO.
UPDATE "Contact"
SET "countryZone" = CASE
  WHEN "countryCode" IS NULL OR btrim("countryCode") = '' THEN NULL
  WHEN upper(btrim("countryCode")) = 'DE' THEN 'DE'::"CountryZone"
  WHEN upper(btrim("countryCode")) IN (
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','EL','HU','IE','IT',
    'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'
  ) THEN 'EU'::"CountryZone"
  ELSE 'NON_EU'::"CountryZone"
END;

-- Altes Freitextfeld entfernen
ALTER TABLE "Contact" DROP COLUMN "countryCode";
