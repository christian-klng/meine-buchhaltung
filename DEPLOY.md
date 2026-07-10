# Deployment auf Coolify

Die App ist ein einzelner Docker-Container (Next.js standalone) + eine PostgreSQL-Ressource. Der `Dockerfile` baut, `docker-entrypoint.sh` migriert beim Start und startet den Server als non-root-User.

## 1. Pflicht-Environment-Variablen

Ohne diese startet der Container bewusst **nicht** (fail-fast im Entrypoint):

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | Postgres-Verbindung. Interner Coolify-Postgres: `...?sslmode=disable` reicht. **Externer/managed Postgres:** `sslmode=require` (ggf. `verify-full` mit CA), sonst bricht die Verbindung. |
| `AUTH_SECRET` | 32+ Byte Zufallswert (`openssl rand -base64 48`). Signiert die Session-Cookies. **Rotation invalidiert alle Sessions** (Notfall-Logout). |
| `AUTH_PASSWORD` | Login-Passwort. **Lang & stark wählen** — der Brute-Force-Schutz sperrt nach 5 Fehlversuchen, ersetzt aber kein starkes Passwort. |

Optional: `UPLOAD_DIR` (Default `/app/uploads`).

## 2. Persistentes Volume für Belege — PFLICHT (GoBD)

Die Original-Belege liegen unter **`/app/uploads`**. Ohne persistentes Volume sind sie nach dem nächsten Deploy weg.

- In Coolify ein **Persistent Storage** auf den Container-Pfad `/app/uploads` legen.
- Der Container läuft als uid **1001** (`nextjs`); der Entrypoint chownt das Volume beim Start auf 1001 und macht eine Schreibprobe. Schlägt sie fehl, bricht der Start mit klarer Meldung ab.

## 3. Skalierung

**Replicas = 1.** Die App nutzt ein lokales Upload-Volume und ein In-Memory-Rate-Limit; mehrere Instanzen würden beides aufteilen. `migrate deploy` beim Start ist über Prisma-Advisory-Lock abgesichert, aber mehrere Replicas sind hier nicht sinnvoll.

## 4. Healthcheck

Öffentlicher Endpoint **`GET /api/health`** (von der Auth-Middleware ausgenommen). Im `Dockerfile` ist ein `HEALTHCHECK` gesetzt; in Coolify den Healthcheck zusätzlich auf `/api/health` (HTTP 200) konfigurieren.

## 5. Backups

- **Datenbank:** Coolify-DB-Backup aktivieren.
- **Upload-Volume:** Coolifys DB-Backup deckt die Dateien **nicht** ab. Separates, automatisiertes Backup des `/app/uploads`-Volumes einrichten (Scheduled Task mit `restic`/`rsync` auf Off-site/Object-Storage), zeitlich mit dem DB-Backup gekoppelt.
- **Restore mindestens einmal testen** (DB + Dateien gemeinsam) — die Originalbelege sind das Wertvollste.

## 6. Migrationen

`docker-entrypoint.sh` führt beim Start `prisma migrate deploy` aus (mit Wait/Retry gegen kurzzeitig nicht erreichbare DB). Neue Migrationen entstehen lokal mit `npx prisma migrate dev --name <x>` und werden mit deployt.

## 7. Erststart

1. Postgres-Ressource in Coolify anlegen, `DATABASE_URL` in die App übernehmen.
2. `AUTH_SECRET` + `AUTH_PASSWORD` als Secrets setzen.
3. Persistent Storage `/app/uploads` anlegen. **Der Name darf keine Leerzeichen/Umlaute enthalten** (Docker-Volume-Name), z. B. `uploads`.
4. Deploy. Der Entrypoint erledigt automatisch:
   - `prisma migrate deploy` (legt die 10 Tabellen an),
   - **Seed** (Kategorien + Lieferanten-Matrix) — **nur bei leerer DB** (idempotent, überschreibt keine späteren UI-Anpassungen). Beim ersten Deploy sind danach 10 Kategorien + 27 Lieferanten-Regeln da.
5. Unter `/login` anmelden.

**Seed erzwingen** (z. B. um die gelockten Seed-Regeln nach einer Änderung neu zu laden): im App-Container ausführen
`FORCE_SEED=1 node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts` (Coolify → App → Terminal).
