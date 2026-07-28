# kfzBlitz24-Shop ↔ WerkstattConnect — Integrations-Spec

> **Zielgruppe:** Shop-Entwickler (Shopware-Team) bei kfzBlitz24
> **Autor:** WerkstattConnect-Team
> **Status:** Draft v1 · benötigt Review + Rückmeldung vom Shop-Team

---

## 1. Big Picture

**WerkstattConnect** (`connect.kfzblitz24-group.com`) ist unsere SaaS-Lösung für Kfz-Werkstätten. Werkstätten verwalten dort Kunden, Fahrzeuge, Termine, Rechnungen und ein digitales Wartungsheft.

**Vision:** Eine Werkstatt, die WerkstattConnect nutzt UND B2B-Kunde im kfzBlitz24-Shop ist, soll Ersatzteile **direkt aus einem Auftrag heraus** finden, in den Warenkorb legen und bestellen — ohne den Shop separat öffnen zu müssen.

**Beispiel-Flow:**
1. Mechaniker legt in WerkstattConnect eine Rechnung an: „Bremsscheiben + Beläge vorne" für BMW 320d mit HSN/TSN `0005/BJU`
2. Er klickt **„Teile bei kfzBlitz24 suchen"**
3. WerkstattConnect zeigt inline (embedded oder als Modal) die passenden Artikel aus dem Shop mit **B2B-Preisen** dieser Werkstatt
4. Mechaniker wählt Scheiben-Satz + Belag-Satz, klickt **„In Warenkorb legen"**
5. Die Artikel landen im Warenkorb der Werkstatt im Shop; parallel werden sie als Positionen in die Rechnung übernommen
6. Beim Checkout im Shop bezahlt die Werkstatt; die Rechnung an ihren Endkunden ist in WerkstattConnect bereits fertig

---

## 2. Zentrale Anwendungsfälle

| # | Use-Case | Priorität |
|---|----------|-----------|
| 1 | **Account-Verknüpfung**: Werkstatt-Admin verbindet ihren B2B-Shop-Account einmalig mit ihrem WerkstattConnect-Mandanten | **P0** |
| 2 | **Teile-Suche mit HSN/TSN**: Passende Artikel für ein bestimmtes Fahrzeug finden | **P0** |
| 3 | **Live-Preise**: B2B-Preis dieser Werkstatt (nicht Standardpreis) anzeigen | **P0** |
| 4 | **In Warenkorb legen**: Aus WerkstattConnect direkt in den Shop-Warenkorb dieser Werkstatt schieben | **P0** |
| 5 | **Bestellstatus abfragen**: Ist die Bestellung vom Auftrag XYZ schon versandt? | P1 |
| 6 | **Verfügbarkeit**: Ist der Artikel auf Lager, wann lieferbar? | P1 |
| 7 | **Umsatz-Statistik**: „Werkstatt hat 2026 für 8.400 € Teile bei uns bestellt" | P2 |

---

## 3. Was wir vom Shop-Team brauchen

### 3.1 Authentifizierung: OAuth2 (Vorschlag)

Wir wollen einen sauberen **OAuth2-Authorization-Code-Flow** — kein Passwort-Sharing, kein API-Token-Copy-Paste.

**Flow-Skizze:**
```
Werkstatt-Admin klickt in WerkstattConnect: [Shop-Account verknüpfen]
  → Redirect zu kfzblitz24.de/oauth/authorize?client_id=werkstattconnect&scope=b2b:read+cart:write&redirect_uri=https://connect.kfzblitz24-group.com/api/kb24/callback
  → Shop-Login (falls nicht schon eingeloggt)
  → Zustimmung: "WerkstattConnect darf in deinem Namen Artikel suchen und in den Warenkorb legen"
  → Redirect zurück mit code
  → WerkstattConnect tauscht code gegen access_token + refresh_token
  → gespeichert in Workshop.kb24AccessToken (encrypted)
```

**Braucht Shop-Team:**
- OAuth2-Server-Endpoint (`/oauth/authorize`, `/oauth/token`)
- Client-Registrierung für WerkstattConnect (client_id, client_secret)
- Scopes definieren: mindestens `b2b:read`, `cart:write`, `orders:read`
- Refresh-Token-Rotation

**Alternative (falls OAuth2 Overkill):** API-Token pro Werkstatt, das der Werkstatt-User in seinem Shop-Account selbst generiert und in WerkstattConnect einträgt. Weniger nice UX, aber schneller umgesetzt.

### 3.2 REST-API-Endpunkte (Wunschliste)

Alle Endpunkte unter `https://api.kfzblitz24.de/v1/`, JSON-Response, mit `Authorization: Bearer <token>`:

#### `GET /me`
Prüft ob Token gültig ist, gibt B2B-Kunden-Info zurück.
```json
{
  "customer_id": "B2B-12345",
  "company": "Auto Meier GmbH",
  "vat_id": "DE123456789",
  "customer_group": "b2b_werkstatt_gold",
  "credit_limit_cent": 500000,
  "credit_used_cent": 84500
}
```

#### `GET /parts/search`
Teile-Suche nach Fahrzeug + Kategorie + Freitext.

**Query-Params:**
- `hsn` (Herstellerschlüssel, 4-stellig)
- `tsn` (Typschlüssel, 3-stellig)
- `q` (Freitext, z.B. "Bremsbelag vorne")
- `category` (optional: "brakes" | "engine" | "filter" | …)
- `limit` (default 20, max 100)

**Response:**
```json
{
  "results": [
    {
      "sku": "BRK-VA-BMW320D-2019",
      "name": "Bremsbelag-Satz TRW GDB1550",
      "brand": "TRW",
      "category": "brakes",
      "image_url": "https://cdn.kfzblitz24.de/…",
      "price_net_cent": 4790,     // B2B-Preis dieser Werkstatt
      "price_list_cent": 6900,    // UVP zum Vergleich
      "stock": "available",       // 'available' | 'low' | 'oos' | '3-5days'
      "delivery_eta_days": 1,
      "fits_hsn_tsn": true,       // matched das explizit angefragte Fahrzeug?
      "product_url": "https://kfzblitz24.de/…"
    }
  ],
  "total": 143
}
```

Kritisch: **`price_net_cent` muss der B2B-Preis dieser konkreten Werkstatt sein** (nicht Standard-UVP). Sonst zeigt WerkstattConnect falsche Preise und Werkstatt kalkuliert falsch.

#### `GET /parts/{sku}`
Einzelner Artikel, ausführlich (für Detail-Modal).

#### `POST /cart/items`
Artikel in den Warenkorb der Werkstatt legen.

**Request:**
```json
{
  "items": [
    { "sku": "BRK-VA-BMW320D-2019", "quantity": 1 },
    { "sku": "BRK-DISC-VA-BMW320D", "quantity": 1 }
  ],
  "workshop_reference": "AN-26-0042"  // unsere Angebots/Rechnungs-Nr für Tracking
}
```

**Response:**
```json
{
  "cart_id": "CART-98765",
  "checkout_url": "https://kfzblitz24.de/checkout?cart=CART-98765",
  "total_net_cent": 13740,
  "items_added": 2
}
```

WerkstattConnect leitet den Nutzer dann optional in einem neuen Tab zum `checkout_url` weiter, wenn er "Jetzt bestellen" klickt. Andernfalls landen die Artikel einfach im Warenkorb den er später im Shop bearbeitet.

#### `GET /orders/{order_id}` (Prio 1, nicht MVP)
Status-Abfrage einer Bestellung (versandt? Track & Trace?).

#### `POST /webhooks/orders` (Prio 1, nicht MVP)
Wir würden gerne einen Webhook registrieren um über Statusänderungen benachrichtigt zu werden (order versandt → Werkstatt sieht in WerkstattConnect grünen Haken beim Auftrag).

### 3.3 Datenmapping — was der Shop kennen muss, was wir liefern

**Bei jeder Warenkorb-Aktion senden wir mit:**
- Interne Auftragsnummer (`workshop_reference`): damit der Shop Bestellungen bündeln oder Statistiken bauen kann
- Optional: Fahrzeug-Daten (HSN/TSN, VIN) — falls Shop das für Empfehlungen nutzen will

**Wir speichern nichts vom Shop persistent außer:**
- `kb24AccessToken` + `kb24RefreshToken` pro Werkstatt (verschlüsselt at-rest)
- `kb24CustomerId` (rein informativ, wird angezeigt)

**Wir cachen nichts:** Preise + Verfügbarkeiten immer live abfragen (max 5min Client-Cache) — sonst verkauft die Werkstatt zu falschen Preisen.

---

## 4. UX-Flow im WerkstattConnect

### 4.1 Account verknüpfen (einmalig)
`/app/settings/integrations` → Card **"kfzBlitz24-Shop"** → Button `[Account verknüpfen]` → OAuth-Flow → nach callback: **"✓ Verbunden als Auto Meier GmbH (Gold-Kunde)"** + Trennen-Button.

### 4.2 Teile im Composer suchen
Im Rechnungs-/Angebots-Composer neben dem "Aus Katalog"-Button:
`[🔍 Teile bei kfzBlitz24]` → öffnet Modal:
- Automatisch vor-gefüllt mit HSN/TSN aus dem Kunden-Fahrzeug wenn ausgewählt
- Suchleiste + Kategorie-Filter
- Ergebnisse als Kacheln mit Bild, Name, Preis, Stock-Badge
- Multi-select mit Menge
- `[In Warenkorb legen + Positionen übernehmen]` → schiebt Artikel gleichzeitig in Shop-Warenkorb UND als "part"-Positionen ins Rechnungs-Dokument
- Werkstatt-Aufschlag wird automatisch angewandt (Workshop.partsMarkupPercent)

### 4.3 Bestellungen einsehen (Post-MVP)
`/app/bestellungen` — Liste aller Shop-Bestellungen mit Status, Track & Trace, Verknüpfung zu Ursprungs-Auftrag.

---

## 5. Sicherheit + DSGVO

- Access-Token + Refresh-Token verschlüsselt at-rest (AES-256-GCM mit key aus `AUTH_SECRET`)
- Nur Werkstatt-Admin darf Account verknüpfen (nicht normale Mitarbeiter)
- Trennen-Button widerruft Token im Shop (Shop muss `/oauth/revoke` bereitstellen)
- **Kein Daten-Sharing zu unserer Seite ohne User-Aktion** — wir pullen nur auf explizite User-Anfrage
- Wenn Werkstatt-Account in WerkstattConnect gelöscht wird → Token wird revoked
- AVV-Regelung zwischen kfzBlitz24 GmbH und WerkstattConnect ist trivial da beides gleiche GmbH

---

## 6. Was das Shop-Team klären muss

1. **Shopware-Version + Plugin-Stack?** — Shopware 6 hat OAuth2 nativ, Shopware 5 braucht Plugin
2. **B2B-Suite installiert?** — für customer_group-basierte Preise
3. **API-Endpunkte:** existieren die schon oder müssen wir sie bauen?
4. **HSN/TSN-Suche:** ist die Suche im Shop-Index performant? Wenn nicht, brauchen wir einen dedizierten Endpoint mit vorberechnetem Index
5. **Rate-Limits:** wie oft dürfen wir `/parts/search` aufrufen? Bei live-preisen könnte das 100-200 req/min pro Werkstatt sein
6. **Bestell-Tracking:** hat der Shop Webhook-Support oder müssen wir polling machen?
7. **Sandbox:** gibt es eine Test-Umgebung wo wir gegen echte Daten testen können?

---

## 7. Zeitplan / MVP-Scope

**MVP-Scope für Live-Gehen:**
- Account verknüpfen (OAuth oder API-Token)
- `/parts/search` mit HSN/TSN
- `/cart/items` mit B2B-Preisen
- Modal im Composer

**Post-MVP (v1.1):**
- Bestellstatus + Webhook
- Umsatz-Statistik
- Auto-Empfehlung basierend auf ähnlichen Aufträgen

**Effort-Schätzung WerkstattConnect-Seite:** ~5 Werktage nach Shop-API-Bereitstellung.

---

## 8. Nächste Schritte

1. Shop-Team reviewt dieses Doc und beantwortet Fragen aus §6
2. Wir stimmen OAuth vs. API-Token ab
3. Shop stellt Sandbox-Endpoint + Test-Account bereit
4. Wir bauen den WerkstattConnect-Client + integrieren im Composer
5. Beta-Test mit einer Pilot-Werkstatt (die schon B2B-Kunde ist)
6. Live-Rollout

**Kontakt:** Quentin Leopold · q.leopold@kfzblitz24.de
