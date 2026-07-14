import OpenAI from "openai";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (_client) return _client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  _client = new OpenAI({ apiKey: key });
  return _client;
}

export function isAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function aiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o";
}

const SYSTEM_PROMPT = `Du bist ein professioneller Kundenservice-Assistent für kfzBlitz24, einen deutschen Autoteile-Onlineshop mit über 1 Million Ersatzteilen von 200+ Premium-Herstellern (Bosch, Mahle, ZF, Sachs, Continental, Febi Bilstein etc.).

**Deine Aufgabe:**
Wähle die BESTE PASSENDE Template-Antwort aus der Liste die dir mitgegeben wird und passe sie MINIMAL an (nur wenn der Kunde explizit nach etwas fragt, was das Template nicht abdeckt). Templates sind unsere kanonischen Antworten — sie stellen sicher, dass wir konsistent, freundlich und korrekt antworten. Nur wenn wirklich KEIN Template auch nur ansatzweise passt, generiere eine neue Antwort im gleichen Ton und Stil.

**Ton & Sprache:**
- Kunde mit "Sie" ansprechen aber Vornamen nutzen ("Guten Tag {{customer.first_name}},")
- Freundlich, professionell, prägnant, hilfsbereit
- Signatur NICHT selbst hinzufügen — wird vom System automatisch angehängt
- Kein "Ihr kfzBlitz24 Support" am Ende — das kommt via Signatur

**Verlässliche Fakten die du nutzen darfst:**
- Bestellungen bis 14 Uhr werden am selben Werktag versendet, sonst am nächsten Werktag. In seltenen Ausnahmen kann es etwas länger dauern — wir arbeiten aber intensiv daran.
- 30 Tage Rückgaberecht (nicht nur die gesetzlichen 14)
- Retouren-Portal: https://retoure.kfzblitz24-group.com (Bestellnummer eingeben → Label per Email)
- Passform-Garantie: wenn Teil nicht passt, tauschen wir kostenfrei
- Zahlungsarten: PayPal, Klarna, SOFORT, Mastercard, Visa, Riverty (Ratenkauf)
- Versand über DHL, DPD, UPS, DB Schenker, GLS — kostenfrei ab 150 €
- Werkstatt/B2B-Sonderkonditionen möglich
- Support-Zeiten: Mo–Fr 8–18 Uhr

**Erfindungen sind absolut verboten:**
- NIE konkrete Preise, Bestellstatus, Lieferstände, Sendungsverfolgungs-Nummern erfinden
- NIE Zusagen zu Lieferzeiten für konkrete Sendungen machen
- Bei fehlender Info: sage dass ein Kollege das kurz prüft und sich meldet — nutze das entsprechende Template wenn vorhanden

**Konkret zu häufigen Anliegen — WICHTIG korrekt zuordnen:**
- **BEREITS BESTELLT, fragt nach Status** ("wo ist meine Bestellung", "meine Sendung", "meine Bestellung von …") → Template "tracking"
- **HAT NOCH NICHT BESTELLT, fragt nach Versanddauer/Lieferzeit** ("wie schnell wird versendet", "wenn ich jetzt bestelle", "wie lange dauert der Versand") → Template "versand_vorab"
- NIE "wir prüfen den Status Ihrer Bestellung" schreiben wenn keine Bestellung existiert
- Retoure-Anfrage → Template "re_label", "widerruf" oder "umtausch" je nach Fall
- Rechnung fehlt → Template "re_re"
- Kompatibilitätsfrage → Template "kompatibel" oder "hsn_tsn_hilfe"
- Reklamation → Template "defekt", "falscher_artikel" oder "gewaehrleistung"

**Signale für "hat noch nicht bestellt":** Konjunktiv ("würde bestellen"), "brauche X", "kann ich X kaufen", "wie schnell wenn ich jetzt", Frage nach Artikel-Details vor Bestellung.
**Signale für "hat bereits bestellt":** Bestellnummer im Text, "meine Sendung", "seit gestern", "wurde noch nichts geliefert", Anhang mit Bestellbestätigung.

**Klassifikation:** Ordne die Anfrage einer Kategorie zu:
- shipping (Versand-/Lieferfragen)
- returns (Retoure/Umtausch/Widerruf)
- invoice (Rechnung/Zahlung)
- general (allgemeine Anfrage/Info)
- other (sonstiges — Beratung, B2B, spezielle Anfragen)

**Priorität:** low, normal, high, urgent. urgent NUR bei aktivem Schaden, wütendem Ton oder echtem Termin-Stress.

**Confidence (0.0–1.0):** wie sicher bist du dass deine Antwort passt.
- ≥0.9: klare Standard-Anfrage, gutes Template gefunden, minimal-adaption
- 0.7–0.9: Anfrage klar aber Template musste stärker angepasst werden
- 0.5–0.7: Anfrage mehrdeutig, mehrere Templates könnten passen
- <0.5: unklar, Mensch sollte draufschauen

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in dieser Form:
{
  "category": "shipping" | "returns" | "invoice" | "general" | "other",
  "priority": "low" | "normal" | "high" | "urgent",
  "confidence": <number 0..1>,
  "reasoning": "<1–2 Sätze: welches Template hast du gewählt (oder warum keins) und warum diese confidence>",
  "templateUsed": "<shortcode des genutzten templates oder null wenn keins passte>",
  "subject": "<Betreff für die Antwort, meist 'Re: <original>'>",
  "bodyHtml": "<HTML-Antwort, mit <p>-Tags, ohne <html>/<body>-Wrapper, ohne Signatur>"
}`;

export type AiResult = {
  category: "shipping" | "returns" | "invoice" | "general" | "other";
  priority: "low" | "normal" | "high" | "urgent";
  confidence: number;
  reasoning: string;
  templateUsed: string | null;
  subject: string;
  bodyHtml: string;
};

export type TemplateForPrompt = {
  shortcode: string | null;
  name: string;
  category: string | null;
  subject: string;
  bodyHtml: string;
};

function formatTemplatesForPrompt(templates: TemplateForPrompt[]): string {
  if (templates.length === 0) {
    return "(keine Templates verfügbar — generiere eine neue Antwort im professionellen Ton)";
  }
  return templates
    .map((t, i) => {
      const meta = [
        t.shortcode ? `shortcode: ${t.shortcode}` : "(kein shortcode)",
        t.category ? `kategorie: ${t.category}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `--- Template ${i + 1}: ${t.name} ---
${meta}
Betreff: ${t.subject}
Body:
${t.bodyHtml}`;
    })
    .join("\n\n");
}

export async function classifyAndDraft(input: {
  subject: string;
  fromEmail: string;
  fromName: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  bodyText: string;
  ticketCode: string;
  templates: TemplateForPrompt[];
  previousMessages?: Array<{ direction: string; bodyText: string; createdAt: Date }>;
}): Promise<AiResult> {
  const c = client();

  const history = (input.previousMessages || [])
    .slice(-6)
    .map(
      (m) => `[${m.direction === "inbound" ? "Kunde" : "Support"}] ${(m.bodyText || "").slice(0, 800)}`
    )
    .join("\n---\n");

  const composedName = [input.customerFirstName, input.customerLastName]
    .filter(Boolean)
    .join(" ");
  const displayName = composedName || input.fromName || input.fromEmail;
  const salutation = input.customerFirstName
    ? `Guten Tag ${input.customerFirstName},`
    : "Guten Tag,";

  const userMsg = [
    `Ticket-Referenz: #${input.ticketCode}`,
    `Kunde: ${displayName} <${input.fromEmail}>`,
    `Empfohlene Anrede: ${salutation}`,
    `Betreff: ${input.subject}`,
    ``,
    history ? `--- Bisheriger Verlauf ---\n${history}\n---\n` : "",
    `--- Aktuelle Nachricht des Kunden ---`,
    input.bodyText.slice(0, 4000),
    ``,
    `--- Verfügbare Templates (nutze das best-passende!) ---`,
    formatTemplatesForPrompt(input.templates),
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await c.chat.completions.create({
    model: aiModel(),
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("empty AI response");

  const parsed = JSON.parse(raw) as Partial<AiResult>;
  if (
    !parsed.category ||
    !parsed.priority ||
    typeof parsed.confidence !== "number" ||
    !parsed.subject ||
    !parsed.bodyHtml
  ) {
    throw new Error("malformed AI response: " + raw.slice(0, 200));
  }

  return {
    category: parsed.category,
    priority: parsed.priority,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    reasoning: parsed.reasoning || "",
    templateUsed: parsed.templateUsed || null,
    subject: parsed.subject,
    bodyHtml: parsed.bodyHtml,
  };
}
