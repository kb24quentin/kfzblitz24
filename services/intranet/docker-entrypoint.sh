#!/bin/sh
set -e

cd /app

echo "==> Running Prisma migrations"
prisma migrate deploy

# Intranet uses Google-SSO-only — no ADMIN_PASSWORD, just ADMIN_EMAIL.
if [ -n "$ADMIN_EMAIL" ]; then
  echo "==> Running seed (idempotent) for admin: $ADMIN_EMAIL"
  node prisma/seed.js || echo "[entrypoint] seed failed, continuing"
fi

echo "==> Starting Next.js"
exec "$@"
