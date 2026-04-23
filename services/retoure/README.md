# Retoure Portal (technischer Prototyp)

Customer-facing order lookup that talks (eventually) to the Abisco ERP via
the Webisco XML protocol. Current scope is intentionally minimal:

1. Single search field for the order number (+ Beleg-Typ selector)
2. Hits `/api/lookup` → server-side fetches `beleganfrage` from Webisco
3. Renders the matched beleg(e) with all positions, showing article number,
   description, quantity, status, and remaining return-eligible quantity
   (`offene_gutschriftsmenge`)

## Demo mode

If `WEBISCO_HOST` / `WEBISCO_USERNAME` / `WEBISCO_PASSWORD` are unset — or
`WEBISCO_DEMO_MODE=true` is set — the API returns mocked data so the UI
can be tested without a real Abisco connection.

Try `demo`, `12345`, or `R123456` as the order number.

## ⚠️ Licensing caveat

Per the Webisco spec, the protocol is for **client** implementations only.
A customer-facing portal that calls Webisco server-side technically
violates that clause — Abisco's own `Abisco-Connect` is the proper API for
server-to-server use. This service is built as a technical PoC; before
going live, contact Abisco for the right license.

## Environment

See `.env.example`.

## Domains

- Staging: `https://retoure.staging.kfzblitz24-group.com`
- Prod: `https://retoure.kfzblitz24-group.com`

## Next steps

- Reach Webisco from the VPS (needs VPN tunnel or public exposure — port
  8228 is typically internal)
- Add customer verification (email + order number, or similar) before
  revealing order data
- Add retour submission flow (send `<auftrag positionsids="server">` back
  via `createauftrag`)
