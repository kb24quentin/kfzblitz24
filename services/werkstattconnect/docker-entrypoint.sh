#!/bin/sh
set -e

cd /app

echo "==> Running Prisma migrations"
prisma migrate deploy

if [ -n "$ADMIN_EMAILS" ] || [ -n "$ADMIN_EMAIL" ]; then
  echo "==> Running seed (idempotent)"
  node prisma/seed.js || echo "[entrypoint] seed failed, continuing"
fi

echo "==> Starting Next.js"
exec "$@"
