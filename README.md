# Beleg-Prüf-App

> Selbst gehostete Buchhaltungs-Vorerfassung: **Upload → Extraktion → Prüf-UI → Bankabgleich.**
> Eine schrittweise, günstige Ergänzung und Teil-Ablösung von Lexware — auf eigener Infrastruktur, mit den Originalbelegen im eigenen Haus (GoBD).

Belege (PDF) landen per Upload in der App, werden automatisch ausgelesen und über eine Lieferanten-Matrix vorkontiert. In einer Split-View prüfst und korrigierst du den Vorschlag; anschließend gleicht die App die Belege gegen den Bankauszug (camt / CSV) ab. Der fachliche Kern — Cent-Arithmetik, 70/30-Split, § 13b Reverse-Charge, Fremdwährung — ist rein, deterministisch und vollständig durch Tests abgesichert.

Kein weiteres Cloud-SaaS: Die App läuft als **ein Docker-Container plus PostgreSQL** auf eigener Hardware (Deployment-Ziel: [Coolify](https://coolify.io)).

---

## Die Pipeline

| Schritt | Was passiert |
|---|---|
| **1 · Upload** | PDF hochladen → sha256-Hash & Dedup → revisionssichere Ablage → Textlayer via [unpdf](https://github.com/unjs/unpdf) → Feld-Extraktion (Betrag, Datum, Belegnummer, Lieferant) |
| **2 · Vorkontierung** | Lieferanten-Matrix erzeugt einen Beleg-Vorschlag: Kategorie, 70/30-Split, § 13b-Status und ggf. Fremdwährungs-Kennung |
| **3 · Prüf-UI** | Split-View mit Original-Vorschau neben editierbarem Formular: Split-Editor mit Live-Summen-Invariante, § 13b-Erfassung, Fremdwährungs-Hard-Stop mit EUR-Korrektur, Speichern/Bestätigen mit Audit-Log |
| **4 · Bankabgleich** | camt.052/053 oder CSV importieren → Matching gegen offene Belege (Betrag + Datum + Gegenpartei; FX: nur Gegenpartei + Datum). Zeigt Vorschläge, Buchungen ohne Beleg, Belege ohne Buchung und Duplikate. „Zuordnen" schreibt einen `ReconciliationLink` und übernimmt bei Fremdwährung automatisch den echten EUR-Betrag |

Dazu: **Dashboard** (offene Belege, Fremdwährung, § 13b auf einen Blick), **Lieferanten-Matrix**, **§ 13b-Quartalsauswertung** und **Single-User-Passwortschutz** (signierte httpOnly-Session-Cookies, geschützte Routen per Middleware, Rate-Limit / Lockout gegen Brute-Force).

## Fachliche Invarianten

Diese Regeln sind der Kern der Anwendung und dürfen nicht brechen — sie sind in [`src/lib/`](src/lib) implementiert und getestet:

- **Cent-Integer überall.** Geld ist immer ganzzahliger Cent-Wert, nie Fließkomma.
- **Split 70/30:** `business = round(brutto × 0,7)`, `privat = brutto − business` — die Summe stimmt exakt, ohne Rundungsverlust.
- **§ 19 ≠ befreit von § 13b.** Reverse-Charge bei EU-/Auslandsleistungen wird erfasst (Land, Flag, EUR-Basis, Satz). Nur `reverseCharge = ja` fließt in die Auswertung.
- **Fremdwährung mit Hard Stop.** Fremdwährungsbelege gehen in Status `awaiting_fx`; der echte EUR-Betrag entsteht **erst nach bestätigtem Bankmatch** — vorher keine Auswertung.
- **Seed-Regeln sind `locked`** und werden nicht durch Auto-Lernen überschrieben.

## Tech-Stack

- **[Next.js 16](https://nextjs.org)** — App Router, TypeScript, Full-Stack in einer Codebase
- **[Prisma 7](https://www.prisma.io)** + **PostgreSQL** über den `pg`-Driver-Adapter
- **[Tailwind CSS 4](https://tailwindcss.com)**
- **[unpdf](https://github.com/unjs/unpdf)** (PDF-Textlayer), **[fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)** (camt), **[Vitest](https://vitest.dev)** (Tests)
- Deployment: **[Coolify](https://coolify.io)** (Docker, `output: "standalone"`)

## Schnellstart (lokale Entwicklung)

Es wird **kein** lokal installiertes Postgres oder Docker benötigt — `prisma dev` startet eine lokale Datenbank.

```bash
# 1. Abhängigkeiten
npm install

# 2. Lokale Datenbank starten (gibt eine postgres://…-URL aus)
npx prisma dev

# 3. .env anlegen (siehe .env.example) und mindestens setzen:
#    DATABASE_URL   = die URL aus Schritt 2
#    AUTH_SECRET    = openssl rand -base64 48
#    AUTH_PASSWORD  = dein Login-Passwort (Dev z. B. test1234)

# 4. Schema anwenden + Stammdaten laden (10 Kategorien, 27 Lieferanten-Regeln)
npx prisma migrate deploy
npm run db:seed

# 5. Dev-Server
npm run dev        # → http://localhost:3000
```

Optionale Demo-Fixtures (Reset + 2 Belege + camt-Auszug, reproduzierbar):

```bash
npx tsx scripts/seed-demo.ts
```

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server (Turbopack) |
| `npm run build` / `npm start` | Produktions-Build / -Server |
| `npm test` / `npm run test:watch` | Vitest-Suite über den Domain-Kern |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Prisma-Client nach `src/generated/prisma` |
| `npx prisma migrate deploy` | Migrationen anwenden |
| `npm run db:seed` | Kategorien + Lieferanten-Matrix laden (idempotent) |
| `npm run db:studio` | Prisma Studio |

## Projektstruktur

```
prisma/schema.prisma   Datenmodell (10 Tabellen). Geld immer Integer-Cent.
prisma/seed.ts         Kategorien (Lexware-IDs) + Lieferanten-Matrix (gelockt)

src/lib/               Deterministischer Kern — rein & getestet
  money.ts               Cent-Arithmetik
  split.ts               kanonische 70/30-Formel, Summen-Invariante
  reverse-charge.ts      § 13b: nur „ja" zählt; USt = Basis × Satz; Quartals-Aggregation
  fx.ts                  Fremdwährungs-Korrektur nach bestätigtem Bankmatch
  reconciliation.ts      Matching Betrag + Datum + Gegenpartei; FX-Sonderweg; Duplikate
  ingest.ts              Upload-Loop: Hash/Dedup/Ablage → Textlayer → Extraktion → Vorschlag
  bank/                  camt.052/053 + CSV → normalisierte BankTransaction
  auth.ts                Single-User-Session (Web Crypto HMAC, Edge + Node)

src/app/               UI: Dashboard, belege, lieferanten, abgleich, reverse-charge, login
src/middleware.ts      Schützt alle Routen außer /login und /api/health
docs/                  Blueprint & kritisches Review
```

## Tests

Der Domain-Kern ist rein und ohne Datenbank testbar:

```bash
npm test   # 59 Tests in 10 Dateien (money, split, reverse-charge, fx,
           # reconciliation, extraction, apply-rule, bank, auth, rate-limit)
```

## Deployment

Coolify-fertig: Next.js standalone im Docker-Container, `docker-entrypoint.sh` migriert und seedet beim Start, läuft als non-root-User, mit DB-Wait/Retry, Volume-Schreibprobe, fail-fast Env-Checks und `/api/health`-Healthcheck.

**Vollständiges Runbook:** [DEPLOY.md](DEPLOY.md) — inkl. Pflicht-Env-Variablen, persistentem Upload-Volume (GoBD) und Backup-Strategie.

## Dokumentation

- [docs/Beleg-App-Plan.md](docs/Beleg-App-Plan.md) — Blueprint & Gesamtplan
- [docs/Beleg-App-Plan-Review.md](docs/Beleg-App-Plan-Review.md) — kritisches Review
- [DEPLOY.md](DEPLOY.md) — Deployment-Runbook (Coolify)
