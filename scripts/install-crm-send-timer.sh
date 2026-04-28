#!/usr/bin/env bash
# Installs (or refreshes) the systemd timer that periodically POSTs to
# the CRM /api/send endpoint to flush queued campaign emails.
#
# Usage:  install-crm-send-timer.sh <staging|prod>
set -euo pipefail

ENV="${1:?Usage: install-crm-send-timer.sh <staging|prod>}"
if [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "ERROR: env must be 'staging' or 'prod'" >&2
  exit 1
fi

REPO_DIR="/opt/kfzblitz24"
SRC_DIR="$REPO_DIR/scripts/systemd"
UNIT="crm-send-${ENV}"

echo "==> Installing $UNIT.service + .timer"
sudo cp "$SRC_DIR/${UNIT}.service" "/etc/systemd/system/${UNIT}.service"
sudo cp "$SRC_DIR/${UNIT}.timer"   "/etc/systemd/system/${UNIT}.timer"

echo "==> Reloading systemd"
sudo systemctl daemon-reload

echo "==> Enabling + starting timer"
sudo systemctl enable --now "${UNIT}.timer"

echo "==> Done"
systemctl status "${UNIT}.timer" --no-pager
echo ""
echo "Logs:    journalctl -u ${UNIT}.service -f"
echo "Disable: sudo systemctl disable --now ${UNIT}.timer"
