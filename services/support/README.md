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
- [x] Phase 2 — Ticket-Detail (Thread, Notizen, Antwort-Composer, Templates)
- [x] Phase 3 — Gmail-Sync-Worker + Resend-Send + Sent-Insert
- [x] Phase 4 — OpenAI Draft-Vorschläge + Auto-Send-Whitelist
- [ ] Phase 5 — Prod-Cutover

## Gmail-Setup (einmalig)

Um `service@kfzblitz24.de` per OAuth anzubinden:

1. Google Cloud Console → neues Projekt "kb24-support-gmail"
2. APIs & Services → Gmail API aktivieren
3. OAuth Consent Screen → Interner Nutzertyp (Workspace)
4. Credentials → OAuth 2.0 Client-ID → Web-App
   - Authorized redirect URI: `https://developers.google.com/oauthplayground`
5. OAuth Playground (developers.google.com/oauthplayground):
   - Zahnrad oben rechts → "Use your own OAuth credentials" → Client-ID + Secret einfügen
   - Als `service@kfzblitz24.de` einloggen
   - Scopes: `https://www.googleapis.com/auth/gmail.modify` + `.send`
   - Exchange authorization code → `refresh_token` kopieren
6. In `.env.staging` auf VPS eintragen:
   ```
   GMAIL_CLIENT_ID=...
   GMAIL_CLIENT_SECRET=...
   GMAIL_REFRESH_TOKEN=...
   GMAIL_USER_EMAIL=service@kfzblitz24.de
   ```
7. Container neu starten → `docker restart support_staging support_cron_staging`

## Resend-Domain-Setup (einmalig)

Damit ausgehende Mails als `service@kfzblitz24.de` durchgehen (statt gespooft-warnung):

1. Resend Dashboard → Domains → Add Domain: `kfzblitz24.de`
2. Die 3 angezeigten DNS-Records (SPF-Include + DKIM-CNAME + DMARC) bei Hostinger DNS für `kfzblitz24.de` ergänzen (kein MX!)
3. Auf Resend "Verify" klicken

Bis das durch ist, sendet Resend weiter, aber Empfänger sehen "via resend.dev" im Header.

## Cron

Ein `support-cron`-Container (curl-basiert, analog `retoure-cron`) pollt:
- alle `GMAIL_POLL_SECONDS` (default 60s) → `POST /api/cron/gmail-sync`
- alle `SLA_POLL_SECONDS` (default 300s) → `POST /api/cron/sla-check`

Beide Endpunkte prüfen `Authorization: Bearer $API_TOKEN`.
