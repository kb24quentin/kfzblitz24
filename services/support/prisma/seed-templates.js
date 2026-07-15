/**
 * One-off seed of the standard kfzBlitz24 support templates.
 *
 * Idempotent: uses upsert by unique `name`. Existing templates are left alone
 * (updates only when user hasn't customized — we overwrite). Safe to run
 * multiple times, e.g. as part of a deploy hook or manually via:
 *
 *   docker exec support_prod node prisma/seed-templates.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TEMPLATES = [
  // ── Retoure & Widerruf ─────────────────────────────────────────────────
  {
    name: "Retoure-Label anfordern",
    shortcode: "re_label",
    category: "returns",
    subject: "Ihre Retoure-Anfrage",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>gerne stellen wir Ihnen ein Retouren-Label bereit. Bitte nutzen Sie unser Retouren-Portal:</p>
<p><a href="https://retoure.kfzblitz24-group.com">retoure.kfzblitz24-group.com</a></p>
<p>Geben Sie dort Ihre Bestellnummer ein — Sie erhalten das Label direkt per E-Mail zum Ausdrucken. Bitte kleben Sie es gut sichtbar auf das Paket und geben es bei DHL ab.</p>
<p>Nach Eingang und Prüfung der Ware erstatten wir den Kaufpreis auf Ihr ursprüngliches Zahlungsmittel — üblicherweise innerhalb von 3–5 Werktagen.</p>`,
  },
  {
    name: "Altteilrückgabe / Pfand",
    shortcode: "alt_pfand",
    category: "returns",
    subject: "Ihre Altteilrückgabe",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>für die Altteilrückgabe zu Bestellung <strong>{{order.id}}</strong> senden Sie uns bitte das Altteil zusammen mit einer Kopie der Rechnung (oder unter Angabe der Bestellnummer) an folgende Adresse:</p>
<p><strong>kfzBlitz24 GmbH</strong><br>
Altteilrückgabe<br>
Bomhardstraße 7<br>
82031 Grünwald bei München</p>
<p>Sobald das Altteil bei uns eingegangen und geprüft ist, erstatten wir Ihnen den Pfandbetrag auf Ihr ursprüngliches Zahlungsmittel — üblicherweise innerhalb von 5–7 Werktagen nach Eingang.</p>
<p>Wichtig: Bitte verpacken Sie das Altteil sicher (auslaufsicher bei ölhaltigen Teilen), damit Transportschäden vermieden werden.</p>`,
  },
  {
    name: "Retouren-Status Nachfrage",
    shortcode: "re_status",
    category: "returns",
    subject: "Zu Ihrer Retoure",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>wir haben Ihre Nachfrage zur Retoure erhalten. Sobald die Ware bei uns eingeht, prüfen wir diese und veranlassen umgehend die Rückerstattung auf Ihr ursprüngliches Zahlungsmittel. Nach Wareneingang dauert die Bearbeitung üblicherweise 3–5 Werktage.</p>
<p>Über den Fortschritt halten wir Sie automatisch per E-Mail auf dem Laufenden. Sollten Sie in der Zwischenzeit die Sendungsverfolgung Ihrer Retoure prüfen wollen, nutzen Sie bitte die Tracking-Nummer, die Sie beim Versand erhalten haben.</p>`,
  },
  {
    name: "Widerruf",
    shortcode: "widerruf",
    category: "returns",
    subject: "Ihr Widerruf",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>wir haben Ihren Widerruf zur Bestellung <strong>{{order.id}}</strong> zur Kenntnis genommen. Bitte senden Sie den Artikel innerhalb von <strong>14 Tagen</strong> zurück.</p>
<p>Ein Retouren-Label erhalten Sie unter <a href="https://retoure.kfzblitz24-group.com">retoure.kfzblitz24-group.com</a>.</p>
<p>Nach Eingang und Prüfung der Ware erstatten wir Ihnen den Kaufpreis inkl. der ursprünglichen Versandkosten auf Ihr ursprüngliches Zahlungsmittel — üblicherweise innerhalb von 5 Werktagen.</p>`,
  },
  {
    name: "Defekt / Reklamation",
    shortcode: "defekt",
    category: "complaint",
    subject: "Reklamation zu Ihrem Artikel",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>es tut uns leid, dass der erhaltene Artikel Mängel aufweist. Damit wir Ihnen bestmöglich helfen können, benötigen wir kurz folgende Informationen:</p>
<ol>
<li>Kurze Beschreibung des Defekts</li>
<li>Ein oder zwei Fotos des Mangels</li>
<li>Ihre Bestellnummer (falls noch nicht im Betreff)</li>
</ol>
<p>Nach Erhalt Ihrer Rückmeldung prüfen wir umgehend und melden uns mit Lösungsvorschlägen — je nach Fall Austausch, Rückerstattung oder Reparaturmöglichkeiten.</p>`,
  },
  {
    name: "Falscher Artikel geliefert",
    shortcode: "falscher_artikel",
    category: "complaint",
    subject: "Reklamation: falscher Artikel",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>wir bedauern sehr, dass Sie einen falschen Artikel erhalten haben — Entschuldigung für die Umstände.</p>
<p>Damit wir Ihnen schnellstmöglich helfen können, senden Sie uns bitte:</p>
<ol>
<li>Welchen Artikel haben Sie erhalten? (Bezeichnung / Artikelnummer vom Etikett)</li>
<li>Ein Foto vom erhaltenen Artikel und vom Verpackungsetikett</li>
</ol>
<p>Sobald diese Info da ist, klären wir umgehend den weiteren Ablauf inkl. kostenfreiem Rückversand des falschen Artikels und Versand des korrekten Artikels.</p>`,
  },
  {
    name: "Beschwerde / Entschuldigung",
    shortcode: "entschuldigung",
    category: "complaint",
    subject: "Zu Ihrer Rückmeldung",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>vielen Dank für Ihre offene Rückmeldung — und Entschuldigung für die entstandenen Umstände. Wir nehmen Kritik ernst und prüfen, wie wir das künftig besser machen können.</p>
<p>Damit wir Ihren konkreten Fall schnell klären können: könnten Sie uns kurz beschreiben, was genau schiefgelaufen ist? Sobald wir alle Details kennen, melden wir uns mit einem konkreten Lösungsvorschlag.</p>`,
  },
  // ── Versand & Bestellung ────────────────────────────────────────────────
  {
    name: "Sendungsverfolgung / Wo ist meine Bestellung",
    shortcode: "tracking",
    category: "shipping",
    subject: "Sendungsverfolgung zu Ihrer Bestellung",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>wir prüfen den Status Ihrer Bestellung und melden uns umgehend zurück.</p>
<p>Zur Orientierung: Bestellungen die uns bis <strong>14 Uhr</strong> erreichen, versenden wir in der Regel am <strong>selben Werktag</strong> — spätere Bestellungen gehen am nächsten Werktag raus. In seltenen Fällen kann es mal etwas länger dauern, wir arbeiten dann aber mit Hochdruck daran.</p>
<p>Sobald die Sendung an DHL/DPD übergeben wurde, erhalten Sie automatisch eine Tracking-Nummer per E-Mail (bitte ggf. auch den Spam-Ordner prüfen).</p>`,
  },
  {
    name: "Versanddauer bei neuer Bestellung",
    shortcode: "versand_vorab",
    category: "shipping",
    subject: "Zu Ihrer Frage zur Versanddauer",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>gerne! Bestellungen die uns bis <strong>14 Uhr</strong> erreichen, versenden wir in der Regel am <strong>selben Werktag</strong> — spätere Bestellungen gehen am nächsten Werktag raus. Die Zustellung durch DHL/DPD dauert danach üblicherweise <strong>1–3 Werktage</strong>.</p>
<p>Wenn Sie sich unsicher sind, ob der Artikel zu Ihrem Fahrzeug passt: senden Sie uns kurz Ihre HSN + TSN (Fahrzeugschein Feld 2.1 und 2.2) oder Ihre Fahrgestellnummer, wir prüfen die Kompatibilität gerne vorab für Sie.</p>
<p>Falls Sie noch Fragen zum Artikel, zu Zahlungsarten oder zur Bestellung haben, melden Sie sich einfach — wir helfen gerne weiter.</p>`,
  },
  {
    name: "Bestellung stornieren (noch nicht versandt)",
    shortcode: "storno_ok",
    category: "shipping",
    subject: "Ihre Stornierungsanfrage",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>gerne haben wir Ihre Bestellung <strong>{{order.id}}</strong> storniert. Der bereits belastete Betrag wird auf Ihr ursprüngliches Zahlungsmittel zurückerstattet — je nach Zahlungsart innerhalb von 3–10 Werktagen.</p>
<p>Sollten Sie den Artikel doch noch benötigen, freuen wir uns über eine neue Bestellung.</p>`,
  },
  {
    name: "Storno nicht mehr möglich (bereits versandt)",
    shortcode: "storno_zu_spaet",
    category: "shipping",
    subject: "Zu Ihrer Stornierungsanfrage",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>leider können wir Ihre Bestellung <strong>{{order.id}}</strong> nicht mehr stornieren, da diese bereits an den Versanddienstleister übergeben wurde.</p>
<p>Sie können den Artikel nach Erhalt jedoch problemlos innerhalb der Widerrufsfrist zurücksenden. Ein kostenfreies Retouren-Label erhalten Sie unter <a href="https://retoure.kfzblitz24-group.com">retoure.kfzblitz24-group.com</a> nach Eingabe Ihrer Bestellnummer.</p>`,
  },
  {
    name: "Adresse ändern (vor Versand)",
    shortcode: "adresse_ok",
    category: "shipping",
    subject: "Ihre Adressänderung",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>wir haben die Lieferadresse für Ihre Bestellung <strong>{{order.id}}</strong> entsprechend Ihrer Angaben aktualisiert. Die Sendung geht an die neue Adresse.</p>
<p>Wenn wir sonst noch etwas für Sie tun können, melden Sie sich gerne.</p>`,
  },
  {
    name: "Adresse ändern (schon versandt)",
    shortcode: "adresse_zu_spaet",
    category: "shipping",
    subject: "Zu Ihrer Adressänderung",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>leider können wir die Lieferadresse für Ihre Bestellung <strong>{{order.id}}</strong> nicht mehr auf unserer Seite ändern, da diese bereits an den Versanddienstleister übergeben wurde.</p>
<p>Bitte wenden Sie sich direkt an DHL/DPD über die Sendungsverfolgung — in vielen Fällen lässt sich die Adresse dort direkt anpassen, solange die Sendung noch nicht in der Zustellung ist.</p>`,
  },
  // ── Rechnung & Zahlung ──────────────────────────────────────────────────
  {
    name: "Rechnung nachsenden",
    shortcode: "re_re",
    category: "invoice",
    subject: "Ihre Rechnung zur Bestellung",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>gerne senden wir Ihnen Ihre Rechnung zur Bestellung <strong>{{order.id}}</strong> nochmals zu. Im Anhang finden Sie die Rechnung als PDF.</p>
<p>Bitte prüfen Sie auch Ihren Spam-Ordner, falls die ursprüngliche Bestätigungs-Mail bei Ihnen nicht angekommen ist.</p>`,
  },
  {
    name: "Zahlung noch nicht eingegangen",
    shortcode: "zahlung_offen",
    category: "invoice",
    subject: "Zu Ihrer Zahlung",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>aktuell sehen wir noch keinen Zahlungseingang zu Ihrer Bestellung <strong>{{order.id}}</strong>. Da wir vor Versand den Zahlungseingang abwarten, kommt es aktuell zu einer Verzögerung.</p>
<p>Sobald die Zahlung eingegangen ist, senden wir Ihre Bestellung umgehend raus. Falls Sie bereits gezahlt haben, senden Sie uns gerne einen Zahlungsnachweis (Screenshot oder Beleg) — dann können wir das schneller klären.</p>`,
  },
  // ── Beratung ────────────────────────────────────────────────────────────
  {
    name: "Fahrzeug-Kompatibilität prüfen",
    shortcode: "kompatibel",
    category: "advisory",
    subject: "Passt der Artikel zu Ihrem Fahrzeug?",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>gerne prüfen wir die Kompatibilität des Artikels für Ihr Fahrzeug. Bitte senden Sie uns dafür folgende Daten aus Ihrem Fahrzeugschein:</p>
<ol>
<li><strong>HSN</strong> (Feld 2.1 im Fahrzeugschein)</li>
<li><strong>TSN</strong> (Feld 2.2 im Fahrzeugschein)</li>
<li><strong>Fahrgestellnummer (VIN)</strong> — 17-stellig, meist im Bereich der Windschutzscheibe</li>
</ol>
<p>Optional zusätzlich: Fabrikat, Modell, Baujahr und Motorleistung — dann können wir die Zuordnung noch schneller vornehmen. Mit diesen Angaben erhalten Sie eine verbindliche Rückmeldung, ob der Artikel passt.</p>`,
  },
  {
    name: "HSN/TSN im Fahrzeugschein finden",
    shortcode: "hsn_tsn_hilfe",
    category: "advisory",
    subject: "So finden Sie HSN und TSN",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>bei einer <strong>Zulassungsbescheinigung Teil I</strong> (der übliche „Fahrzeugschein" seit 2005) finden Sie die Angaben hier:</p>
<ul>
<li><strong>HSN</strong> (Herstellerschlüsselnummer): Feld <strong>2.1</strong> — 4 Ziffern</li>
<li><strong>TSN</strong> (Typschlüsselnummer): Feld <strong>2.2</strong> — 3 Ziffern und Buchstaben</li>
</ul>
<p>Bei einem alten Kfz-Schein (vor 2005): HSN steht in Zeile <strong>2</strong>, TSN in Zeile <strong>3</strong>.</p>
<p>Alternativ funktioniert auch die Fahrgestellnummer (VIN, 17-stellig) — mit der können wir Ihr Fahrzeug ebenfalls eindeutig zuordnen. Senden Sie uns einfach die Daten und wir prüfen die Passform des Artikels für Sie.</p>`,
  },
  {
    name: "Passgenauigkeits-Garantie",
    shortcode: "passgarantie",
    category: "complaint",
    subject: "Zu Ihrer Passgenauigkeits-Garantie",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>wir haben Ihre Nachricht zur Passgenauigkeit erhalten. Unsere Passform-Garantie greift genau in solchen Fällen — sollte der Artikel nicht zu Ihrem Fahrzeug passen, senden wir Ihnen kostenfrei den richtigen zu.</p>
<p>Damit wir Ihnen schnell weiterhelfen können, benötigen wir kurz:</p>
<ol>
<li>Ihre HSN + TSN (Feld 2.1 und 2.2 im Fahrzeugschein) oder alternativ die Fahrgestellnummer (VIN)</li>
<li>Die Artikelbezeichnung / Artikelnummer des bestellten Teils</li>
<li>Kurz: was passt konkret nicht (Foto hilfreich)?</li>
</ol>
<p>Nach Rückmeldung klären wir den kostenfreien Rücktausch und ermitteln das passende Teil für Ihr Fahrzeug.</p>`,
  },
  {
    name: "Umtausch statt Retoure",
    shortcode: "umtausch",
    category: "returns",
    subject: "Umtausch Ihrer Bestellung",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>gerne tauschen wir Ihren Artikel gegen ein passendes Modell. Der Ablauf ist einfach:</p>
<ol>
<li>Bestellen Sie das gewünschte Ersatz-Modell neu in unserem Shop</li>
<li>Senden Sie den ersten Artikel innerhalb von 30 Tagen mit einem Retouren-Label zurück: <a href="https://retoure.kfzblitz24-group.com">retoure.kfzblitz24-group.com</a></li>
<li>Nach Eingang der Rücksendung erstatten wir den Kaufpreis auf Ihr ursprüngliches Zahlungsmittel</li>
</ol>
<p>Falls Sie sich beim Ersatz-Artikel unsicher sind, prüfen wir vorab gerne die Passform für Ihr Fahrzeug — Fahrzeugschein-Daten (HSN/TSN) genügen.</p>`,
  },
  {
    name: "Gewährleistung / Garantie",
    shortcode: "gewaehrleistung",
    category: "complaint",
    subject: "Zu Ihrer Garantie-/Gewährleistungs-Anfrage",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>wir bearbeiten Ihre Anfrage im Rahmen der gesetzlichen Gewährleistung (2 Jahre) bzw. der Herstellergarantie. Für eine Prüfung benötigen wir kurz:</p>
<ol>
<li>Ihre Bestellnummer <strong>{{order.id}}</strong> (bereits bekannt) und das genaue Datum, wann der Mangel aufgetreten ist</li>
<li>Beschreibung des Defekts: Was funktioniert nicht (mehr)?</li>
<li>Fotos, die den Mangel dokumentieren</li>
<li>Bei Verschleißteilen: aktueller Kilometerstand seit Einbau</li>
</ol>
<p>Nach Prüfung melden wir uns mit den nächsten Schritten. Bei berechtigten Garantiefällen ist der Rückversand für Sie kostenfrei.</p>`,
  },
  {
    name: "Original-Hersteller-Teil",
    shortcode: "original_teil",
    category: "advisory",
    subject: "Zu Ihrer Frage: Original-Teil?",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>bei uns finden Sie ausschließlich Erstausrüster- und Marken-Ersatzteile von führenden Herstellern wie <strong>Bosch, Mahle, ZF, Sachs, Continental, Febi Bilstein</strong> und über 200 weiteren Premium-Marken.</p>
<p>Diese Teile werden in vielen Fällen sogar direkt für die Fahrzeughersteller (BMW, VW, Mercedes etc.) produziert — nur ohne Hersteller-Logo. Qualitativ sind sie identisch mit den „Originalen" aus der Vertragswerkstatt, aber deutlich günstiger.</p>
<p>Falls Sie ein spezifisches OEM-Teil (mit Fahrzeughersteller-Logo) benötigen: sagen Sie uns die OE-Nummer und wir prüfen die Verfügbarkeit.</p>`,
  },
  {
    name: "Werkstatt-/B2B-Konditionen",
    shortcode: "b2b_konditionen",
    category: "advisory",
    subject: "Werkstatt- und Firmenkonditionen",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>vielen Dank für Ihr Interesse an unseren B2B-Konditionen für Werkstätten, Autohäuser und Flottenbetreiber. Wir bieten:</p>
<ul>
<li>Sonderpreise gestaffelt nach Bestellvolumen</li>
<li>Firmenrechnung mit Zahlungsziel (nach Bonitätsprüfung)</li>
<li>Persönlicher Ansprechpartner</li>
<li>Bevorzugte Bearbeitung + Priority-Versand</li>
</ul>
<p>Damit wir Ihnen ein passendes Angebot machen können, teilen Sie uns bitte kurz mit:</p>
<ol>
<li>Firmenname + Umsatzsteuer-ID</li>
<li>Anzahl Fahrzeuge / Werkstatt-Plätze</li>
<li>Geschätztes monatliches Ersatzteil-Volumen</li>
</ol>
<p>Wir melden uns danach zeitnah mit konkreten Konditionen zurück.</p>`,
  },
  {
    name: "Ratenkauf (Klarna/Riverty)",
    shortcode: "ratenkauf",
    category: "invoice",
    subject: "Zu Ihrer Frage zum Ratenkauf",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>bei uns können Sie über <strong>Klarna</strong> und <strong>Riverty</strong> in bequemen Raten zahlen. Die Konditionen (Laufzeit, monatliche Rate, Bonitätsprüfung) laufen direkt beim jeweiligen Anbieter — wir haben leider keinen Einfluss auf die Entscheidung.</p>
<p>Fragen zu einer bestehenden Ratenzahlung, Zahlungsplan-Änderungen oder Verzögerungen richten Sie bitte direkt an:</p>
<ul>
<li><strong>Klarna:</strong> <a href="https://www.klarna.com/de/kundenservice/">klarna.com/de/kundenservice</a></li>
<li><strong>Riverty:</strong> <a href="https://www.riverty.com/de/">riverty.com/de</a></li>
</ul>
<p>Bei Fragen zu Ihrer Bestellung selbst (Versand, Artikel, Retoure) sind wir natürlich weiterhin für Sie da.</p>`,
  },
  {
    name: "Rechnung an Firma / andere Rechnungsadresse",
    shortcode: "rechnung_firma",
    category: "invoice",
    subject: "Ihre Rechnung mit Firmen-Adresse",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>gerne stellen wir die Rechnung zu Ihrer Bestellung <strong>{{order.id}}</strong> auf Ihre Firma aus. Bitte senden Sie uns folgende Angaben:</p>
<ol>
<li>Firmenname (exakt wie im Handelsregister)</li>
<li>Anschrift der Firma</li>
<li>Umsatzsteuer-ID (falls vorhanden — reduziert bei EU-B2B-Lieferungen ggf. die USt.)</li>
</ol>
<p>Wir stellen die Rechnung dann kurzfristig neu aus und senden Ihnen die aktualisierte Version per E-Mail zu. Die ursprüngliche Rechnung wird storniert.</p>`,
  },
  {
    name: "Sendung verschollen / nicht angekommen",
    shortcode: "sendung_verschollen",
    category: "shipping",
    subject: "Ihre Sendung ist nicht angekommen",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>es tut uns leid, dass Ihre Sendung noch nicht angekommen ist. Wir starten sofort eine Nachforschung beim Versanddienstleister.</p>
<p>Damit das schnell geht, benötigen wir kurz:</p>
<ol>
<li>Ihre Bestellnummer <strong>{{order.id}}</strong> (bereits bekannt)</li>
<li>Ihre vollständige Lieferadresse zur Verifikation</li>
<li>Bereits verfügbare Sendungsverfolgungs-Nummer (aus Ihrer Versandbestätigung)</li>
<li>Ob eine Nachbarschaftsstelle, Filiale oder Packstation üblich für Sie ist</li>
</ol>
<p>Wir setzen uns direkt mit DHL/DPD in Verbindung und melden uns spätestens innerhalb von 48 Stunden mit einem Zwischenstand. Bei bestätigtem Verlust senden wir Ihnen die Ware selbstverständlich kostenfrei erneut oder erstatten den Kaufpreis.</p>`,
  },
  {
    name: "Versand nach Österreich / Schweiz",
    shortcode: "ausland",
    category: "shipping",
    subject: "Versand ins Ausland",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>gerne liefern wir auch nach <strong>Österreich</strong> und in die <strong>Schweiz</strong>. Bitte beachten Sie:</p>
<ul>
<li><strong>Österreich:</strong> Versandkosten je nach Gewicht ab ca. 9,90 € · Lieferzeit 2-4 Werktage · Zoll entfällt (EU)</li>
<li><strong>Schweiz:</strong> Versandkosten ab ca. 24,90 € · Lieferzeit 3-6 Werktage · Zoll- und Einfuhrgebühren durch den Empfänger zu tragen (üblicherweise 2-3 % + MWSt.)</li>
</ul>
<p>Genaue Konditionen sehen Sie im Checkout nach Eingabe der Lieferadresse. Falls Sie eine spezifische Bestellung planen, kalkulieren wir Ihnen die Kosten gerne vorab — senden Sie uns kurz die Artikel-Liste und das Ziel-Land.</p>`,
  },
  {
    name: "Verfügbarkeit / Sonderbestellung",
    shortcode: "verfuegbarkeit",
    category: "advisory",
    subject: "Zu Ihrer Anfrage zur Verfügbarkeit",
    bodyHtml: `<p>Guten Tag {{customer.first_name}},</p>
<p>wir prüfen die Verfügbarkeit des von Ihnen angefragten Artikels und melden uns umgehend mit einem konkreten Liefertermin.</p>
<p>Falls der Artikel aktuell nicht im Sortiment ist, können wir ihn in vielen Fällen über unsere Hersteller-Netzwerke innerhalb von 3-10 Werktagen beschaffen. Damit wir schnell die richtige Zuordnung finden, senden Sie uns bitte:</p>
<ol>
<li>Artikelbezeichnung, Hersteller und ggf. OE-/Referenz-Nummer</li>
<li>Ihre HSN + TSN (Fahrzeugschein Feld 2.1/2.2) oder Fahrgestellnummer</li>
<li>Gewünschte Liefermenge</li>
</ol>
<p>Mit diesen Angaben können wir Ihnen ein verbindliches Angebot inkl. Lieferzeit machen.</p>`,
  },
];

/**
 * Alle Templates enden mit "Mit freundlichen Grüßen" (Leerzeile davor kommt
 * durch das eigene <p>-Tag). Die Signatur (Name/Position/Logo) hängt der
 * Send-Worker separat an. Wir normalisieren hier statt es in jedem Template
 * einzeln zu pflegen — Änderungen am Grußformular sind so ein Einzeiler.
 */
function ensureClosing(bodyHtml) {
  if (/[Mm]it freundlichen/.test(bodyHtml)) return bodyHtml;
  return `${bodyHtml}\n<p>&nbsp;</p>\n<p>Mit freundlichen Grüßen</p>`;
}

async function main() {
  let created = 0;
  for (const t of TEMPLATES) {
    t.bodyHtml = ensureClosing(t.bodyHtml);
    const variables = Array.from(
      new Set(
        [t.subject, t.bodyHtml]
          .join(" ")
          .matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)
      )
    ).map((m) => m[1]);

    // Skip-existing: NEVER overwrite user-edited templates. Only insert
    // missing ones. Match by name OR shortcode so a rename doesn't dupe.
    const clash = await prisma.template.findFirst({
      where: { OR: [{ name: t.name }, { shortcode: t.shortcode }] },
    });
    if (clash) {
      // Keep user version untouched.
      continue;
    }
    await prisma.template.create({
      data: {
        name: t.name,
        shortcode: t.shortcode,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        category: t.category,
        variables: JSON.stringify(variables),
      },
    });
    created++;
  }
  const skipped = TEMPLATES.length - created;
  console.log(`[seed-templates] created=${created} skipped=${skipped} total=${TEMPLATES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
