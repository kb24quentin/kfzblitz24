#!/usr/bin/env bash
# One-time: install Docker Engine + Compose plugin on Ubuntu 24.04
set -euo pipefail

echo "==> Installing Docker on $(hostname)"

# Remove any old versions
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Prereqs
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl gnupg

# Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Repo
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install
sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add deploy user to docker group
sudo usermod -aG docker "$USER"

# Enable + start
sudo systemctl enable --now docker

echo "==> Done. Versions:"
docker --version
docker compose version

echo ""
echo "NOTE: Log out and back in for docker group membership to take effect."
