# kfzBlitz24 Intranet

Zentrale Landing für alle internen Anwendungen. Google-Workspace-SSO,
per-User × per-App-Rechte-Matrix, News + Wissensdatenbank (im Aufbau).

## URLs

- **Prod:** https://kfzblitz24-group.com (Root-Domain, kein Subdomain)
- **Staging:** https://intranet.staging.kfzblitz24-group.com

## Stack

- Next.js 16 (App Router, standalone)
- Prisma 6 + Postgres 16
- NextAuth 5 mit Google-Provider (nur `@kfzblitz24.de`)

## Deploy

- `develop` → auto-deploy Staging via GitHub Actions
- `main` → auto-deploy Prod
- Manuell: `bash /opt/kfzblitz24/scripts/deploy.sh prod intranet`

## Neue User

1. Kollege loggt sich per Google ein
2. Auto-Provisioned als `active=false` (pending)
3. Admin sieht in `/settings` → Team & App-Rechte, aktiviert + vergibt App-Rechte
4. Kollege sieht bei nächstem Login nur die freigeschalteten Tiles

## App-Registry

Siehe `src/lib/apps.ts`. Um eine neue interne Anwendung als Kachel + Access-
Column zu ergänzen: dort neuen Eintrag hinzufügen, deployen.
