#!/usr/bin/env bash
# One-time: create directory structure + Docker networks on the VPS
set -euo pipefail

REPO_DIR="/opt/kfzblitz24"

echo "==> Creating directory structure"
sudo mkdir -p "$REPO_DIR"
sudo chown -R "$USER:$USER" "$REPO_DIR"

mkdir -p "$REPO_DIR/data/prod"
mkdir -p "$REPO_DIR/data/staging"

echo "==> Creating Docker networks"
docker network create traefik_net 2>/dev/null && echo "  + traefik_net created" || echo "  = traefik_net exists"
docker network create prod_internal 2>/dev/null && echo "  + prod_internal created" || echo "  = prod_internal exists"
docker network create staging_internal 2>/dev/null && echo "  + staging_internal created" || echo "  = staging_internal exists"

echo "==> Done"
docker network ls | grep -E "traefik_net|prod_internal|staging_internal"
