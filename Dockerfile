# syntax=docker/dockerfile:1
# Beleg-Prüf-App — Coolify-Deployment (Next.js standalone + Prisma 7).

# ── Dependencies ──
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
# BuildKit-Cache für npm (überlebt Builds → schnelle Retries), kein Audit/Fund-Netzwerkcall.
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ── Build ──
FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ── Runner ──
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl su-exec wget
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV UPLOAD_DIR=/app/uploads

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# Next.js standalone (server.js + statische Assets)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Volles node_modules aus dem Build: `prisma migrate deploy` beim Start braucht die Prisma-CLI
# inkl. ALLER transitiven Deps (@prisma/config → effect …). Das getracte Standalone-Set allein reicht nicht.
# Überschreibt das (kleinere) Standalone-node_modules mit dem vollständigen Superset — same versions.
COPY --from=build /app/node_modules ./node_modules

# Prisma-Schema + Config für `migrate deploy`
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

# src (inkl. generiertem Prisma-Client) + tsconfig, damit `tsx prisma/seed.ts` im Container läuft (Auto-Seed)
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/uploads && chown -R nextjs:nodejs /app

# Container startet als root; docker-entrypoint.sh chownt das Upload-Volume und dropt dann via su-exec auf nextjs.
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null 2>&1 || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
