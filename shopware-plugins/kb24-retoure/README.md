# kfzBlitz24 Retoure (Shopware-6-Plugin)

Bindet Shopware-Bestellungen an das interne kfzBlitz24-RMA-Portal an.
Kunden sehen im Bestell-Detail ihres Accounts einen orange-farbenen
**"Retoure anmelden"**-Button. Ein Klick erzeugt serverseitig einen
Prefill-Token bei der RMA-API und leitet den Kunden zu
`https://retoure.kfzblitz24-group.com/start?token=…` weiter — dort
ist die Anmeldung schon mit Bestellnr, Anschrift und gekauften
Artikeln vorausgefüllt.

## Wofür existiert das Plugin?

Bisher müssen Kunden die Retoure manuell anmelden und ihre
Bestellnummer abtippen — fehleranfällig und unfreundlich. Das Plugin
verkürzt den Weg auf einen Klick und gibt der RMA-Seite vorab
strukturierte Daten (Order-ID, Customer-ID, Artikelliste), damit
Bestell-Matching im RMA-Backend zuverlässig läuft.

Architektonisch ist das Plugin bewusst **dünn**: keine eigene DB,
keine Eigen-Logik zur Retoure-Bewertung, kein eigener Workflow. Der
gesamte Retoure-Prozess (Statusmaschine, Mails, Etiketten) lebt im
zentralen `services/retoure/`-Monorepo-Service. Das Shopware-Plugin
ist nur ein **Hand-off**.

## Installation

### Option A — Manuell als ZIP (Plugin-Manager)

1. Plugin-Verzeichnis zippen:
   ```bash
   cd shopware-plugins
   zip -r kb24-retoure-0.1.0.zip kb24-retoure
   ```
2. Im Shopware-Admin: **Erweiterungen → Meine Erweiterungen → Erweiterung hochladen** → ZIP wählen.
3. **Installieren** und **Aktivieren**.

### Option B — Composer (empfohlen für CI/CD)

```bash
cd /path/to/shopware-install
composer require kfzblitz24/kb24-retoure
bin/console plugin:refresh
bin/console plugin:install --activate KbRetoure
bin/console cache:clear
```

Damit Composer das Repo findet, in `composer.json` der Shopware-Installation:

```json
{
  "repositories": [
    {
      "type": "path",
      "url": "../kfzblitz24/shopware-plugins/kb24-retoure"
    }
  ]
}
```

## Konfiguration im Admin

**Einstellungen → System → Plugins → kfzBlitz24 Retoure**

| Feld | Beschreibung | Default |
|---|---|---|
| **Plugin aktiviert** | Schaltet die Storefront-Integration an/aus. | `true` |
| **RMA-API Basis-URL** | Vollständige URL ohne Trailing-Slash. | `https://pda.rma.staging.kfzblitz24-group.com` |
| **API-Token (Bearer)** | Bearer-Token für die RMA-API. **Niemals committen.** | _(leer)_ |

Für **Prod** den `apiBaseUrl` auf `https://rma.kfzblitz24-group.com`
umstellen und den Prod-Bearer-Token eintragen.

## Dateistruktur

```
shopware-plugins/kb24-retoure/
├── composer.json
├── README.md
└── src/
    ├── KbRetoure.php                    # Plugin-Bootstrap
    ├── Resources/
    │   ├── config/
    │   │   ├── config.xml               # Admin-Settings-Form
    │   │   ├── routes.xml               # Lädt Controller-Annotations
    │   │   └── services.xml             # DI-Container
    │   └── views/storefront/page/account/order-history/
    │       └── order-detail.html.twig   # Button-Injection
    ├── Service/
    │   └── RetoureApiClient.php         # HTTP-Client gegen RMA-API
    └── Storefront/
        ├── Controller/
        │   └── RetoureController.php    # POST /account/order/retoure
        └── Subscriber/
            └── AccountOrderRouteSubscriber.php  # Page-Event-Listener
```

## Status & offene Punkte (Phase 9)

**Phase 9 — erledigt (2026-05-18):**

1. [x] **API-Endpoint `POST /api/retoure/prefill`** im
   `services/retoure/`-Service. Erzeugt einen 15-Min-Token + JSON-
   Snapshot der Bestelldaten in der Tabelle `RetourePrefill` und
   liefert `{ token, expiresAt, url }` zurück.
2. [x] **Storefront-Controller `frontend.kb24.retoure.start`**
   (`src/Storefront/Controller/RetoureController.php`) — nimmt den
   Klick im Order-Detail entgegen, lädt die Order, mappt sie auf den
   Prefill-Payload, ruft die RMA-API und leitet den Kunden auf die
   zurückgegebene Hand-off-URL um.
3. [x] **routes.xml** registriert die Controller-Annotations.
4. [x] **RetoureApiClient** ruft tatsächlich
   `POST {apiBaseUrl}/api/retoure/prefill` auf und liefert
   `{ token, expiresAt, url }` zurück.

**Übersprungen (Folge-Tasks):**
- PHPUnit-Setup für den Controller (manueller Test im Staging zuerst).
- CI-Pipeline für das Plugin (Composer-Lint + ECS+PHPStan).
- README-Hostname-Check (Default ist Staging; Prod muss im Admin manuell umgestellt werden).

### Neue ENV-Variable im `services/retoure/`

Damit der API-Endpoint die korrekte Hand-off-URL zurückgibt, braucht
der retoure-Service zusätzlich:

| Variable | Default | Bedeutung |
|---|---|---|
| `RETOURE_PUBLIC_URL` | `https://retoure.staging.kfzblitz24-group.com` | Basis-URL des Customer-Portals; an diese URL hängen wir `/start?token=…` an. Auf Prod auf `https://retoure.kfzblitz24-group.com` setzen. |

In den Compose-Files (`docker-compose.staging.yml` /
`docker-compose.prod.yml` des Retoure-Service) ist die Variable
bereits durchgereicht — Wert kommt aus `.env.staging` bzw.
`.env.prod` auf dem VPS.
