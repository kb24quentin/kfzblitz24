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
    │   │   └── services.xml             # DI-Container
    │   └── views/storefront/page/account/order-history/
    │       └── order-detail.html.twig   # Button-Injection
    ├── Service/
    │   └── RetoureApiClient.php         # HTTP-Client gegen RMA-API
    └── Storefront/Subscriber/
        └── AccountOrderRouteSubscriber.php  # Page-Event-Listener
```

## Status & offene Punkte (Phase 9)

Das Plugin ist **Skeleton-vollständig**, aber zwei Bausteine müssen
in Phase 9 nachgezogen werden:

1. **API-Endpoint `/api/retoure/prefill`** im
   `services/retoure/`-Service. Aktuell ist `RetoureApiClient` ein
   echter HTTP-Client, der Endpoint existiert aber noch nicht — der
   Aufruf liefert daher heute 404 und der Client antwortet mit
   `{ error: 'api_error_404' }`. Verhalten ist sauber, nur eben
   nicht produktiv nutzbar bis Phase 9 fertig ist.

2. **Storefront-Controller `frontend.kb24.retoure.start`**. Das
   Twig-Template postet zu dieser Route — der zugehörige Controller
   (`src/Storefront/Controller/RetoureController.php`) ist nicht Teil
   dieses Skeletons und wird in Phase 9 mit dem API-Endpoint
   zusammen geliefert.

Bis dahin ist das Plugin **installierbar und aktivierbar**, der
Button **rendert** auf der Order-Detail-Page, ein Klick führt aber
zu einem 404 in der Storefront. Das ist der gewünschte Zwischenstand
für Phase 8.
