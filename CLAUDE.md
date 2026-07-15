# CLAUDE.md — Persistente Notizen für den Agent

Diese Datei wird beim Start jeder Session gelesen. Sie enthält die
Infrastruktur-Infos die ich brauche um schnell wieder produktiv zu sein
(SSH, VPS, DB, Domains, Workflows). KEINE Geheimnisse hier — nur Pfade
und Verweise.

---

## 1. VPS / SSH

| Feld | Wert |
|------|------|
| Host | `185.190.143.172` |
| User | `deploy` (NOPASSWD sudo) |
| SSH-Key (lokal) | `~/.ssh/kfzblitz24_deploy_ci` |
| Repo auf VPS | `/opt/kfzblitz24` |
| Daten-Volumes | `/opt/kfzblitz24/data/{staging,prod}/<service>` |
| Env-Files | `/opt/kfzblitz24/services/<service>/.env.{staging,prod}` |

**Wichtig:** mehrere SSH-Keys im Home → immer mit `-o IdentitiesOnly=yes -i ~/.ssh/kfzblitz24_deploy_ci` aufrufen, sonst probiert ssh alle Keys durch und Fail2ban blockt nach ein paar Fehlversuchen (Default-Bantime 10–30 Min).

**Standard-Connect-Pattern:**
```bash
ssh -o IdentitiesOnly=yes -i ~/.ssh/kfzblitz24_deploy_ci deploy@185.190.143.172 'echo OK'
```

---

## 2. Monorepo-Layout

```
kfzblitz24/
  traefik/                      # Reverse Proxy + Let's Encrypt
  scripts/deploy.sh             # Wird von GH Actions auf dem VPS gerufen
  services/
    crm/                        # NextAuth + Resend + Prisma
    retoure/                    # Customer-Portal + RMA-Dashboard (1 Container, 2 Hosts)
    grantingb2b/                # B2B Assessment Engine
    whoami/                     # Diagnose
  .github/workflows/
    deploy-staging.yml          # Push develop → auto-deploy staging
    deploy-prod.yml             # Push main   → auto-deploy prod
```

Branching: **develop** → Staging, **main** → Prod. Workflow_dispatch-Trigger benötigen die Datei auf `main` (Default-Branch).

---

## 3. Aktuelle Services

| Service | Staging | Prod | Auth | DB |
|---|---|---|---|---|
| **traefik** | traefik.staging.* | traefik.* | basic-auth dashboard | — |
| **crm** | crm.staging.* | crm.* | NextAuth (`info@kfzblitz24.de`) | `crm_db_staging` Postgres |
| **retoure** (Customer) | `retoure.staging.kfzblitz24-group.com` | `retoure.kfzblitz24-group.com` | — (öffentlich) | shared `retoure_db_*` |
| **retoure** (Admin = RMA) | `rma.staging.kfzblitz24-group.com` | `rma.kfzblitz24-group.com` | NextAuth (`admin@kfzblitz24.de`) | shared `retoure_db_*` |
| **grantingb2b** | grantingb2b.staging.* | grantingb2b.* | NextAuth + API_TOKEN | `grantingb2b_db_*` |

Beide retoure-Hostnames teilen **denselben Container** — host-aware Middleware in `services/retoure/src/middleware.ts` blockt jeweils die andere Seite.

---

## 4. DNS

Hostinger DNS für `kfzblitz24-group.com` hat Wildcards für `*` UND `*.staging`. Heißt: jedes neue Subdomain wie `foo.staging.kfzblitz24-group.com` oder `foo.kfzblitz24-group.com` löst automatisch auf 185.190.143.172. Kein manueller DNS-Eintrag nötig.

---

## 5. CI/CD

```bash
# Deploy-Status checken
gh run list --workflow=deploy-staging.yml --limit 5

# Manuell triggern (falls Auto-Trigger ausgefallen)
gh workflow run deploy-staging.yml --ref develop

# Logs eines fehlgeschlagenen Runs
gh run view <id> --log-failed | tail -60
```

Concurrency-Group `deploy-staging` mit `cancel-in-progress: false` → mehrere schnelle Pushes serialisieren statt parallel.

---

## 6. Daten-Sicherung / Postgres-Zugriff

```bash
# Direkt-Zugriff
ssh -o IdentitiesOnly=yes -i ~/.ssh/kfzblitz24_deploy_ci deploy@185.190.143.172 \
  'docker exec crm_db_staging psql -U crm -d crm -c "SELECT count(*) FROM \"Contact\";"'

ssh ... 'docker exec retoure_db_staging psql -U retoure -d retoure -c "\\dt"'
ssh ... 'docker exec grantingb2b_db_staging psql -U grantingb2b -d grantingb2b -c "\\dt"'
```

---

## 7. Drittsysteme

**Webisco / Abisco** (Warenwirtschaft):
- Host: `http://45.11.228.203:8228`
- Customer-Nummer (username): `10005` (Sammelkunde)
- Admin-ID: in `.env.staging` als `WEBISCO_ADMIN_ID` (Name: "retloesung")
- Protokoll-Version **56** (Server ist auf 57, min. 31 nötig — 21 wurde 2026-07 abgelehnt). Doku als PDF: `/Users/quentinleopold/Downloads/Webisco_Schnittstellenbeschreibung_56.pdf`, Stand 10.04.2026
- License-Caveat: nur Client-Implementierungen erlaubt; Server-Use braucht "Abisco-Connect" — mit Abisco zu klären
- **Lessons learned:**
  - `bestellnummer`-Suche funktioniert nur mit `typ="auftrag"`
  - 365-Tage-Window max bei `beleganfrage`
  - `parseAttributeValue: true` im XML-Parser frisst führende Nullen bei PLZ → in `services/retoure/src/lib/webisco.ts` deshalb `parseAttributeValue: false`

**dodajpaczke.eu** (DHL-Retoure-Aggregator):
- Base: `https://api.dodajpaczke.eu/v1`
- Provider-ID **36** = DHL Retoure
- Shipper-ID (kfzBlitz24): `47729913`
- Auth-Schema: **raw Token** im `Authorization`-Header, KEIN `Bearer`-Prefix (untypisch, in Doku versteckt)
- Label-Endpoint für Provider-36-Sendungen: **`/shippingLabel`** (nicht `/retoureLabel`)
- Postman-Collection: `https://api.dodajpaczke.eu/docs/DodajPaczke.eu%20API.postman_collection.json`

**Resend** (Mail für CRM):
- Domain `kfzblitz24-group.com` verifiziert
- Webhook: `https://crm.kfzblitz24-group.com/api/webhook/resend` (svix-Signatur-Verifikation)

**OpenAI** (grantingb2b):
- gpt-4o-mini für Vision-OCR
- gpt-4.1 + Responses API + `web_search_preview` Tool (Name ist `_preview`, nicht plain `web_search`)
- `text.format.type="json_object"` ist NICHT kombinierbar mit `web_search` → Marker-Delimiter im Prompt verwenden

---

## 8. Brand-Design (PDF + Web)

Source-of-Truth: `/Users/quentinleopold/Desktop/GewährleistungsantragKB24/kfzBlitz24-Formular-Designguide.md`

Hex-Farben:
| Rolle | Hex |
|---|---|
| NAVY (primär) | `#0b3756` |
| ORANGE (akzent) | `#ff6600` |
| LIGHT_GREY | `#e6e8eb` |
| MID_GREY | `#8a93a0` |
| DARK_GREY | `#3d4654` |

Logo = **gesetzter Text** in Helvetica-Bold ("kfz" NAVY · "blitz" ORANGE · "24" NAVY), kein SVG/Bitmap, kein Punkt nach 24.

PDF-Sonderheiten:
- pdf-lib + Helvetica-StandardFont kennt nur WinAnsi → Unicode-Symbole wie ✂ werfen → in PDF-Code stattdessen Text-Hinweise
- 14pt Brand-Bar links (NAVY full + ORANGE top 170pt)
- Versions-Code "RET-KB24 · Rev. MM/YYYY · vX.Y" rotiert 90° am rechten Rand

---

## 9. Konventionen

- Commit-Messages: feature/fix prefix mit service-namespace, z.B. `fix(retoure/pdf): …`
- Co-Author-Trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Push nur auf `develop` ohne Rückfrage; `main` braucht explizite User-Freigabe (Auto-Mode-Classifier blockt sonst)
- Kein `npm run` auf prod-Hosts; alle Service-Operationen über `docker compose` im jeweiligen Service-Ordner
- env-Files NIE in git committen — nur auf VPS unter `/opt/kfzblitz24/services/<svc>/.env.*` (chmod 600)

---

## 10. Bekannte Schmerzpunkte

- **Fail2ban-Lockouts**: mehrere SSH-Keys im Agent → immer `IdentitiesOnly=yes -i …` nutzen, sonst ban
- **GH-Actions runner-Lag**: bei "Actions outage" laut githubstatus.com kann ein Push 15–30 Min queued bleiben — direkter SSH-Deploy via `bash /opt/kfzblitz24/scripts/deploy.sh staging <service>` ist Fallback
- **prisma + Next standalone**: Prisma-CLI muss global installiert sein (`npm install -g prisma@…` im Dockerfile-Runner) damit der entrypoint `prisma migrate deploy` aufrufen kann
- **package-lock.json** muss bei jeder Dep-Änderung lokal regeneriert werden (`npm install --package-lock-only`) sonst bricht `npm ci` im CI-Build

---

## 11. To-Continue-Markers (laufende Arbeit)

Siehe Todo-Liste im Session-State. Stand jetzt:
- **Retoure-Portal**: Phase 1 (Dashboard + REST-API) fertig, Customer/Admin-Hosts gesplittet
- **Nächste Batch 1.8**: dodajpaczke `/history` Polling alle 30 Min für aktive Cases
- **Phase 2/3** offen: Eurohermes-Scan-Webhook, Artikel-Prüfung
- **Aufgaben für mich** beim nächsten Mal: OpenAI-Key rotieren, Abisco-Gespräch-Outcome festhalten

Wenn du diese Datei aktualisierst, prüfe ob die Pfade/Hostnames noch stimmen und ergänze ein "Stand: YYYY-MM-DD" in §11.

Stand: 2026-05-18
