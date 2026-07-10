#!/bin/sh
set -e

# ── Pflicht-Env prüfen (sonst stiller Lockout / falsche DB) — fail-fast mit klarer Meldung ──
: "${DATABASE_URL:?FEHLER: DATABASE_URL ist nicht gesetzt}"
: "${AUTH_SECRET:?FEHLER: AUTH_SECRET ist nicht gesetzt (App wäre sonst gesperrt)}"
: "${AUTH_PASSWORD:?FEHLER: AUTH_PASSWORD ist nicht gesetzt (Login unmöglich)}"
if [ "${#AUTH_SECRET}" -lt 24 ]; then
  echo "FEHLER: AUTH_SECRET ist zu kurz (< 24 Zeichen). Bitte 32+ Byte Zufallswert setzen." >&2
  exit 1
fi
UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"

# ── Upload-Volume (GoBD-Originalbelege) für den App-User beschreibbar machen ──
# Bind-Mounts überdecken das Image-Verzeichnis und gehören oft root:root → als root chownen.
mkdir -p "$UPLOAD_DIR"
if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs "$UPLOAD_DIR" || true
fi
if ! su-exec nextjs:nodejs sh -c ": > \"$UPLOAD_DIR/.probe\" && rm -f \"$UPLOAD_DIR/.probe\""; then
  echo "FEHLER: $UPLOAD_DIR ist für den App-User nicht beschreibbar — bitte Coolify-Volume-Rechte prüfen." >&2
  exit 1
fi

# ── Auf DB warten & Migration anwenden (Retry statt Crash-Loop bei kurz nicht erreichbarer DB) ──
echo "→ Prisma migrate deploy"
i=0
until su-exec nextjs:nodejs node ./node_modules/prisma/build/index.js migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge 12 ]; then
    echo "FEHLER: migrate deploy nach 12 Versuchen fehlgeschlagen." >&2
    exit 1
  fi
  echo "  DB/Migration nicht bereit — neuer Versuch in 5 s ($i/12)"
  sleep 5
done

echo "→ Starting Next.js on ${HOSTNAME}:${PORT}"
exec su-exec nextjs:nodejs node server.js
