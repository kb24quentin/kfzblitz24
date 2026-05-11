# B2B Assessment Engine

Automatische Prüfung von B2B-Kundenanfragen (Werkstätten, Wiederverkäufer).
Erzeugt einen **Score 0–100** + **Empfehlung** (approve / review / reject) anhand
mehrerer Einzelchecks.

## Live

- Staging: https://grantingb2b.staging.kfzblitz24-group.com
- Prod (geplant): https://grantingb2b.kfzblitz24-group.com

## Endpoints

| Methode | Pfad | Zweck |
|---------|------|-------|
| `GET`  | `/` | UI – Case-Liste |
| `GET`  | `/new` | UI – Case anlegen (mit Datei-Upload) |
| `GET`  | `/cases/[id]` | UI – Case-Detail + Entscheidung |
| `POST` | `/api/cases` | Programmatic create (JSON) |
| `GET`  | `/api/cases/[id]` | Case lesen (JSON) |
| `GET`  | `/api/cases/[id]/gewerbeschein` | Gewerbeschein-Datei |

## Assessment-Checks (aktuell)

**Philosophie:** B2B grob sortieren — eine reale Firma mit sauberer Adresse,
verifiziertem Gewerbeschein und positiver Online-Präsenz reicht für Auto-Approve,
auch ohne USt-ID.

| Check | Quelle | Punkte |
|-------|--------|--------|
| Adresse geocodierbar | OpenStreetMap Nominatim | bis 25 |
| Gewerbeschein-OCR + Datenabgleich | OpenAI gpt-4o-mini (Vision) | bis 22 |
| USt-ID gültig + Name-Match | EU VIES SOAP | bis 25 (optional) |
| Reputations-Recherche | OpenAI gpt-4.1 + web_search | –20 bis +15 |
| Email auf Firmen-Domain | Heuristik (Freemail-Liste) | bis 15 |
| Gewerbeschein hochgeladen | Upload | 8 |
| Telefon angegeben | Feld | 3 (kein Negativ-Abzug) |
| Nachgereichte Dokumente | je Doc | +3 bis +10 |

OpenAI-Calls werden übersprungen wenn `OPENAI_API_KEY` nicht gesetzt ist —
das Assessment läuft dann nur mit VIES + Nominatim + Email-Heuristik.

## Score → Empfehlung

- `≥ 65` → **approve** (auto-status: approved)
- `35–64` → **review** (auto-status: more_docs_needed)
- `< 35` → **reject** (auto-status: rejected)

Soft-Escalation: Fälle mit konkreten Blocker-Dokumenten und Score ≥ 20 werden
auf "review" hochgezogen statt direkt abgelehnt.

Hard-Override: Reputation-`suspicious` Cases landen mindestens auf "review",
auch wenn der Score sonst zum Approve reichen würde.

Admin kann jede Entscheidung in der UI manuell überschreiben.

## API Beispiel

```bash
curl -X POST https://grantingb2b.staging.kfzblitz24-group.com/api/cases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "customerType": "werkstatt",
    "businessSubtype": "kfz_werkstatt",
    "companyName": "Beispiel Werkstatt GmbH",
    "contactFirstName": "Max",
    "contactLastName": "Mustermann",
    "email": "kontakt@beispiel-werkstatt.de",
    "phone": "+49 30 12345678",
    "street": "Musterstraße 1",
    "postalCode": "12345",
    "city": "Berlin",
    "country": "Deutschland",
    "ustId": "DE123456789",
    "externalRef": "SHOP-2026-0042"
  }'
```

Response:

```json
{
  "ok": true,
  "id": "clx...",
  "status": "more_docs_needed",
  "score": 65,
  "recommendation": "review",
  "url": "https://grantingb2b.staging.kfzblitz24-group.com/cases/clx..."
}
```

## Lokales Setup

```bash
npm install
npx prisma migrate dev
npm run dev
```

`.env.local`:

```
DATABASE_URL=postgresql://grantingb2b:secret@localhost:5432/grantingb2b
APP_URL=http://localhost:3000
NOMINATIM_USER_AGENT=kfzblitz24-grantingb2b-dev
```

## Environment-Variablen

| Var | Pflicht | Bedeutung |
|-----|---------|-----------|
| `DATABASE_URL` | ja | Postgres-Verbindung |
| `APP_URL` | nein | Wird in API-Responses als Link zurückgegeben |
| `API_TOKEN` | empfohlen | Bearer-Token für `POST /api/cases`. Wenn leer: kein Auth. |
| `NOMINATIM_USER_AGENT` | nein | User-Agent für OSM (Pflicht laut OSM-Richtlinie); default `kfzblitz24-grantingb2b` |
| `OPENAI_API_KEY` | empfohlen | Aktiviert OCR + Web-Reputation. Ohne Key laufen diese Checks im "skipped" Modus. |
| `UPLOAD_DIR` | nein | Pfad zu Gewerbeschein-Uploads; default `/app/uploads` |
