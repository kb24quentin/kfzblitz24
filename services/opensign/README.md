# OpenSign self-hosted (kfzBlitz24-intern)

Internes Vertrags-/Dokumenten-Signierportal. Basiert auf
[OpenSign Labs](https://github.com/OpenSignLabs/OpenSign) (AGPL-3.0,
DocuSign-Alternative). Lokales File-Storage, lokale MongoDB,
SMTP via Resend.

Erreichbar unter:

- Staging: <https://sign.staging.kfzblitz24-group.com>

## Architektur

```
                ┌───────────────────────────────────────┐
                │  Traefik (TLS termination via LE)     │
                └───┬────────────────────┬──────────────┘
              /*    │                    │  /api/app/*
                    ▼                    ▼
        ┌───────────────┐      ┌──────────────────────┐
        │ opensign_app  │      │ opensign_server      │
        │ React 3000    │ ───► │ Parse Server 8080    │
        └───────────────┘      └──────────┬───────────┘
                                          │
                                          ▼
                                   ┌────────────┐
                                   │ mongo:7    │
                                   │ persistent │
                                   └────────────┘
```

Storage (`/usr/src/app/files`) und MongoDB-Daten liegen außerhalb der
Container in `/opt/kfzblitz24/data/staging/opensign-{files,mongo}`.

## Env-Variablen

Datei: `/opt/kfzblitz24/services/opensign/.env.staging` (chmod 600)

| Variable | Pflicht | Notiz |
|----------|---------|-------|
| `MONGO_USER` | nein | default `opensign` |
| `MONGO_PASSWORD` | **ja** | Random, mind. 20 Zeichen |
| `APP_ID` | **ja** | Muss `opensign` sein — die offizielle `opensign/opensign:main` Frontend-Image-Bundle ist mit `REACT_APP_APPID=opensign` gebaut. Backend muss dem matchen, sonst Login fail. (Custom AppId würde einen eigenen Frontend-Build erfordern.) |
| `MASTER_KEY` | **ja** | Random, gibt Vollzugriff auf alle Daten via Parse-Dashboard |
| `SMTP_USER_EMAIL` | nein | `resend` (Username bei Resend SMTP) |
| `RESEND_API_KEY` | **ja** | Resend API-Key — wird als SMTP-Passwort genutzt |
| `MAILGUN_API_KEY` | nein | Setze auf `disabled` (wir nutzen SMTP) |
| `PFX_BASE64` / `PASS_PHRASE` | nein | Optionales Signier-Zertifikat (PFX/p12 base64) |

## Erstes Setup

1. `.env.staging` auf dem VPS anlegen (chmod 600)
2. Datenverzeichnisse erstellen:
   ```
   mkdir -p /opt/kfzblitz24/data/staging/opensign-mongo \
            /opt/kfzblitz24/data/staging/opensign-files
   ```
3. Erste Bereitstellung via `scripts/deploy.sh staging opensign`
4. Erstes Admin-Konto auf <https://sign.staging.kfzblitz24-group.com>
   anlegen (Sign Up). Sobald angemeldet → in den Admin-Einstellungen
   die User-Selbstregistrierung deaktivieren, damit nur Mitarbeiter
   ein Konto bekommen können.

## License

OpenSign steht unter **AGPL-3.0**. Self-Hosting für interne Nutzung ohne
Modifikation der Sourcen ist unproblematisch. Falls wir das Frontend
forken und modifizieren → die Modifikationen müssen unter AGPL-3.0
verfügbar sein, sobald wir den Dienst über das eigene Unternehmen
hinaus extern bereitstellen.
