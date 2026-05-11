#!/bin/sh
set -e

cd /app

echo "==> Running Prisma migrations"
prisma migrate deploy

echo "==> Starting Next.js"
exec "$@"
