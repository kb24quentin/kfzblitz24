# kfzBlitz24 Support

Internes Support-System für kfzBlitz24. Ticketing + AI-Assist auf Basis von Gmail-Inbound (`service@kfzblitz24.de`) und Resend-Outbound.

## Stack

- Next.js 16 (App Router, standalone build)
- Prisma 6 + Postgres 16
- NextAuth 5 (credentials + bcrypt seed)
- Resend (outbound)
- Google Gmail API (inbound polling)
- OpenAI (Klassifikation + Draft-Antworten)

## Local Dev

```bash
cd services/support
npm install
cp .env.example .env
# .env füllen (DB_PASSWORD, AUTH_SECRET etc.)
npx prisma migrate dev
npm run dev
```

Health-Check: `curl http://localhost:3000/api/health` → `{"ok":true,"db":"up"}`

## Deploy

Push auf `develop` → GitHub Actions → `deploy.sh staging support` auf VPS.
Prod: Push auf `main`.

## Environment

Siehe `.env.example`. Env-Files liegen auf VPS unter
`/opt/kfzblitz24/services/support/.env.staging` bzw. `.env.prod`,
chmod 600, owner `deploy`.

## Architektur (Roadmap)

- [x] Phase 1 — Scaffold: Deploy, Auth, leerer Ticket-Screen
- [ ] Phase 2 — Ticket-Detail (Thread, Notizen, Antwort-Composer, Templates)
- [ ] Phase 3 — Gmail-Sync-Worker + Resend-Send + Sent-Insert
- [ ] Phase 4 — OpenAI Draft-Vorschläge + Auto-Send-Whitelist
- [ ] Phase 5 — SLA-Monitor + Reporting
