# CRM (kb24-acquirer)

Internal Next.js + Prisma CRM for managing contacts, campaigns, and reminders.

## Stack

- Next.js 16 (standalone output) + React 19
- Prisma 6 + PostgreSQL 16
- NextAuth v5 (credentials)
- Resend for transactional email

## Domains

| Env | URL |
|-----|-----|
| Staging | https://crm.staging.kfzblitz24-group.com |
| Production | https://crm.kfzblitz24-group.com |

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values; use DATABASE_URL=file:./prisma/dev.db for SQLite
npx prisma migrate dev
npm run dev
```

## Server runtime

On the VPS, env files live at:
- `/opt/kfzblitz24/services/crm/.env.staging`
- `/opt/kfzblitz24/services/crm/.env.prod`

Both are gitignored. See `.env.example` for the required keys.

The container's entrypoint (`docker-entrypoint.sh`) runs:
1. `prisma migrate deploy` — applies pending migrations
2. `node prisma/seed.js` — creates the admin user if `ADMIN_EMAIL` + `ADMIN_PASSWORD` are set (idempotent)
3. `node server.js` — starts Next.js

## Database

Each environment has its own Postgres container with isolated volumes:
- Staging: `crm_db_staging` → `/opt/kfzblitz24/data/staging/crm-postgres`
- Prod: `crm_db_prod` → `/opt/kfzblitz24/data/prod/crm-postgres`
