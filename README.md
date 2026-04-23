# kfzblitz24 Infrastructure

Internal services hosted on a single Ubuntu VPS, behind Traefik reverse proxy with automatic Let's Encrypt SSL.

## Setup

- **Server:** Ubuntu 24.04 LTS @ `185.190.143.172`
- **Domain:** `kfzblitz24-group.com` (Wildcard A-Record)
- **Reverse Proxy:** Traefik v3 with Let's Encrypt
- **Container Runtime:** Docker + Docker Compose
- **CI/CD:** GitHub Actions → SSH deploy

## Branching Strategy

| Branch | Environment | Auto-deploys to |
|--------|-------------|-----------------|
| `main` | Production | `*.kfzblitz24-group.com` |
| `develop` | Staging | `*.staging.kfzblitz24-group.com` |

Feature branches → PR to `develop` → after testing → PR to `main`.

## Repository Structure

```
.
├── traefik/                # Reverse proxy (runs once per server)
├── services/               # One folder per service
│   └── <service>/
│       ├── docker-compose.staging.yml
│       └── docker-compose.prod.yml
├── scripts/                # Server setup & deployment
└── .github/workflows/      # CI/CD pipelines
```

## Adding a new service

1. Create `services/<name>/docker-compose.{staging,prod}.yml`
2. Use Traefik labels to expose at `<name>.kfzblitz24-group.com` (prod) and `<name>.staging.kfzblitz24-group.com` (staging)
3. Add the service name to `.github/workflows/deploy-*.yml` (or use the matrix)
4. Push → auto-deploy

## Local development

Each service should have its own dev setup (docker-compose.dev.yml or similar). This repo is for infra and deployment.
