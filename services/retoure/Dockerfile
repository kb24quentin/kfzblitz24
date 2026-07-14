FROM node:20-alpine AS base

# Deps
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

# Runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma braucht openssl auf Alpine; Prisma CLI global damit der
# entrypoint `prisma migrate deploy` aufrufen kann.
# poppler-utils liefert `pdftoppm` für die PDF→BITMAP-Rasterisierung
# im Container-Label-Endpoint (services/retoure/src/lib/pdf-to-tspl.ts) —
# damit das pixel-perfekte Dashboard-Design auf dem Xprinter XP-420B
# im Warehouse landet, statt einfaches Text-TSPL.
#
# ttf-freefont + ttf-dejavu + fontconfig sind ZWINGEND — poppler auf
# nacktem Alpine hat KEINE Base-14-Fonts (Helvetica/Times/Courier).
# Ohne Font-Substitution rendert pdftoppm alle Text-Runs als leere Boxen:
# Layout kommt raus, aber alle Beschriftungen fehlen (empirisch bestätigt).
#
# ttf-freefont: FreeSans/FreeSerif/FreeMono als 1:1-metrisch Ersatz für
#               Helvetica/Times/Courier.
# ttf-dejavu:   DejaVu Sans hat deutlich vollständigere Unicode-Coverage,
#               v. a. WinAnsi-Sonderzeichen wie · (U+00B7 middle dot,
#               genutzt in "R00 · KB24-INTERNAL" und "OPENED · OTWARTO"
#               im Palette-Label). FreeSans allein droppt die.
# poppler-data: Extra CIDMap für erweiterte Zeichen-Ranges (CJK, aber
#               auch bessere Fallback-Mappings für Latin-1-Supplement).
RUN apk add --no-cache \
    openssl \
    poppler-utils \
    poppler-data \
    ttf-freefont \
    ttf-dejavu \
    fontconfig \
 && fc-cache -f \
 && npm install -g prisma@6.19.3

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next.js standalone runtime
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma engine + schema + migrations + seed
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Wird vom seed-Skript verwendet (steht nicht im Next-Standalone-Trace)
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
