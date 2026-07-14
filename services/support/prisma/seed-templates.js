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
<p>wir haben Ihre Anfrage zur Sendung erhalten und prüfen den aktuellen Status. Sie erhalten in Kürze eine Rückmeldung mit den Sendungsdaten.</p>
<p>Falls die Sendung bereits an Sie übergeben wurde, sollten Sie zusätzlich eine automatische Benachrichtigung vom Versanddienstleister (DHL / DPD) erhalten haben — bitte prüfen Sie ggf. Ihren Spam-Ordner.</p>`,
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
];

async function main() {
  let created = 0;
  for (const t of TEMPLATES) {
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
