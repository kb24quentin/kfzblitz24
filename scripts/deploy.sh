#!/usr/bin/env bash
# Called by GitHub Actions on the VPS via SSH.
#
# Usage:
#   deploy.sh <env> [service]
#
# Examples:
#   deploy.sh prod              # deploy ALL services + traefik for prod
#   deploy.sh staging whoami    # deploy only whoami for staging
#   deploy.sh prod traefik      # update traefik config
set -euo pipefail

ENV="${1:?Usage: deploy.sh <staging|prod> [service]}"
SERVICE="${2:-all}"
REPO_DIR="/opt/kfzblitz24"

if [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "ERROR: env must be 'staging' or 'prod', got '$ENV'" >&2
  exit 1
fi

cd "$REPO_DIR"

echo "==> Pulling latest from git"
git fetch --all --prune
if [[ "$ENV" == "prod" ]]; then
  git checkout main
  git reset --hard origin/main
else
  git checkout develop
  git reset --hard origin/develop
fi
git log -1 --oneline

deploy_traefik() {
  echo "==> Deploying Traefik"
  cd "$REPO_DIR/traefik"
  if [[ ! -f .env ]]; then
    echo "ERROR: $REPO_DIR/traefik/.env missing. Copy from .env.example and fill in." >&2
    exit 1
  fi
  docker compose pull
  docker compose up -d
  cd "$REPO_DIR"
}

deploy_service() {
  local svc="$1"
  local compose_file="services/$svc/docker-compose.$ENV.yml"
  if [[ ! -f "$compose_file" ]]; then
    echo "  - skip $svc (no $compose_file)"
    return
  fi
  echo "==> Deploying $svc ($ENV)"
  docker compose -p "${svc}_${ENV}" -f "$compose_file" pull
  docker compose -p "${svc}_${ENV}" -f "$compose_file" up -d
}

if [[ "$SERVICE" == "traefik" ]]; then
  deploy_traefik
elif [[ "$SERVICE" == "all" ]]; then
  deploy_traefik
  for dir in services/*/; do
    svc=$(basename "$dir")
    deploy_service "$svc"
  done
else
  deploy_service "$SERVICE"
fi

echo "==> Cleaning up unused images"
docker image prune -f

echo "==> Done"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
