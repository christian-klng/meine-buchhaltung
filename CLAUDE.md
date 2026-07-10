# Beleg-Prüf-App

Selbst gehostete Buchhaltungs-Vorerfassung (Upload → Extraktion → Prüf-UI → Bankabgleich) als schrittweise, günstige Ergänzung/Ablösung von Lexware. Blueprint: [docs/Beleg-App-Plan.md](docs/Beleg-App-Plan.md), kritisches Review: [docs/Beleg-App-Plan-Review.md](docs/Beleg-App-Plan-Review.md).

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) — Full-Stack in einer Codebase
- **Prisma 7** + **PostgreSQL** über den **pg-Driver-Adapter** (`@prisma/adapter-pg`)
- **Tailwind CSS 4**
- **unpdf** (PDF-Textlayer), **fast-xml-parser** (camt), **Vitest** (Tests)
- Deployment-Ziel: **Coolify** (Docker, `output: "standalone"`) — Railway ist nur die andere App

## Befehle

- `npm run dev` — Dev-Server
- `npm test` / `npm run test:watch` — Vitest (Domain-Kern)
- `npm run typecheck` — `tsc --noEmit`
- `npm run db:generate` — Prisma-Client nach `src/generated/prisma`
- `npx prisma migrate deploy` — Migrationen anwenden (lokal & Coolify)
- `npm run db:seed` — Kategorien + Lieferanten-Matrix laden (idempotent)

## Lokale DB (kein Docker/Postgres nötig)

`npx prisma dev` startet einen lokalen Postgres und gibt eine `postgres://…`-URL aus → in `.env` als `DATABASE_URL` eintragen, dann `migrate deploy` + `db:seed`.

## Struktur

- `prisma/schema.prisma` — Datenmodell (10 Tabellen). Geld immer **Integer-Cent**.
- `prisma/seed.ts` — Kategorien (Lexware-IDs) + Lieferanten-Matrix (korrigierte Seed-Regeln).
- `src/lib/` — **deterministischer Kern** (rein & getestet):
  - `money.ts` (Cent-Arithmetik), `split.ts` (kanonische 70/30-Formel, Summen-Invariante)
  - `reverse-charge.ts` (§ 13b: nur `ja` zählt; USt = Basis × Satz; Quartals-Aggregation)
  - `fx.ts` (Fremdwährungs-Korrektur nach bestätigtem Bankmatch)
  - `reconciliation.ts` (Matching Betrag+Datum+Gegenpartei; FX: nur Gegenpartei+Datum; Duplikate über voucherNumber+Betrag)
  - `db.ts` (Prisma-Singleton)
- `src/app/` — UI: Dashboard, `belege`, `lieferanten` (Matrix), `reverse-charge`.

## Fachliche Invarianten (nicht brechen)

- **Cent-Integer** überall; nie Fließkomma auf Beträgen.
- **Split:** `business = round(cents*0.7); privat = brutto − business` (Summe stimmt exakt).
- **§ 19 ≠ befreit von § 13b.** EU-/Auslandsleistungen: Reverse-Charge erfassen (Land, Flag, EUR-Basis, Satz). Nur `reverseCharge = ja` fließt in die Auswertung; `pruefen` nicht.
- **Fremdwährung:** Beleg geht in Status `awaiting_fx`; echter EUR-Betrag erst nach bestätigtem Bankmatch (Hard Stop). FX-Matching ohne Betrag.
- **Seed-Regeln sind `locked`** — nicht durch Auto-Lernen überschreibbar.

## Status

Fertig & verifiziert (40 Tests, Typecheck, Prod-Build, Browser-E2E):
- Datenmodell + Migration, Seed (10 Kategorien, 27 Lieferanten-Regeln)
- Domain-Kern: money, split, reverse-charge, fx, reconciliation, extraction, apply-rule
- **Kern-Loop**: Upload (`belege/actions.ts` → `lib/ingest.ts`) → sha256/Dedup/Ablage → unpdf-Textlayer → Feld-Extraktion → Lieferanten-Matrix → Beleg-Vorschlag (Split/§13b/FX-Status)
- **Prüf-UI** (`belege/[id]`): Split-View mit Original-Vorschau (`/api/files/[id]`), editierbares Formular, Split-Editor mit Live-Summen-Invariante, § 13b, Fremdwährungs-Hard-Stop + EUR-Korrektur (`applyFx`), Speichern/Bestätigen mit Audit-Log
- UI: Dashboard, Belege-Liste, Lieferanten-Matrix, § 13b-Auswertung

- **Bank-Import** (`lib/bank/`): camt.052/053 (XML) + generisches CSV → normalisierte `BankTransaction`; Dispatcher erkennt Format; Import mit Datei-Dedup (`/bank`)
- **Abgleich** (`/abgleich`): `reconcile()` über offene Belege/Abbuchungen; Vorschläge (EUR: Betrag+Datum+Gegenpartei; FX: nur Gegenpartei+Datum), Buchungen ohne Beleg, Belege ohne Buchung, Duplikate. „Zuordnen" schreibt `ReconciliationLink`; bei Fremdwährung wird der EUR-Betrag automatisch übernommen (`applyFxToVoucher`) → fließt direkt in die § 13b-Auswertung.

- **Auth** (`src/lib/auth.ts`, `src/middleware.ts`, `src/app/login/`): Single-User-Passwortschutz über signierte httpOnly-Session-Cookies (Web Crypto HMAC, Edge+Node), Middleware schützt alle Routen außer `/login` + `/api/health`, konstante-Zeit-Passwortprüfung, In-Memory-Rate-Limit/Lockout (`src/lib/rate-limit.ts`), Open-Redirect-Schutz, Logout. Env: `AUTH_SECRET`, `AUTH_PASSWORD`.
- **Deployment** (`Dockerfile`, `docker-entrypoint.sh`, `.dockerignore`, `DEPLOY.md`): Coolify-fertig (Next standalone + Prisma-Migration beim Start, Volume-chown + Schreibprobe, DB-Wait/Retry, fail-fast Env-Checks, Healthcheck). Runbook in [DEPLOY.md](DEPLOY.md).

Dev-Fixtures: `npx tsx scripts/seed-demo.ts` (Reset + 2 Belege + camt-Auszug, reproduzierbar). Lokaler Login: `AUTH_PASSWORD` in `.env` (Dev: `test1234`).

Als Nächstes: erster Coolify-Deploy (Docker-Build dort verifizieren), Vision-Fallback für Bild-PDFs, EÜR-/Reporting-Export.
