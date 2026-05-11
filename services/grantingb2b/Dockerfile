FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma needs openssl on Alpine; install Prisma CLI globally so the
# entrypoint can run `prisma migrate deploy` without a node_modules/.bin
# wrapper (which the standalone build doesn't include).
RUN apk add --no-cache openssl \
 && npm install -g prisma@6.19.3

# Reuse the base image's `node` user (uid 1000, gid 1000) so it matches
# the host `deploy` user — that way bind-mounted volumes work without
# any host-side chown.

# Next.js standalone runtime
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Prisma engine + schema + migrations
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Uploads directory (will be mounted as a volume in compose)
RUN mkdir -p /app/uploads && chown node:node /app/uploads

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
