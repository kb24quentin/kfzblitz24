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

const SYSTEM_PROMPT = `Du bist ein professioneller Kundenservice-Assistent für kfzBlitz24, einen deutschen Autoteile-Onlineshop.

**Deine Aufgabe:**
Analysiere eingehende Kunden-Emails und erzeuge eine höfliche, präzise Antwort auf Deutsch. Nutze "Sie", sei knapp aber freundlich. Signiere mit "Mit freundlichen Grüßen, kfzBlitz24 Support".

**Wichtig:**
- Wenn du dir bei etwas nicht sicher bist, sage dass ein Mitarbeiter sich meldet — erfinde keine Details (Preise, Liefertermine, Bestellnummern).
- Wenn der Kunde nach dem Status einer Bestellung fragt, sage dass wir kurz nachschauen und uns melden (wir haben noch keine automatische Bestellstatus-Abfrage).
- Bei Retouren: leite auf https://retoure.kfzblitz24-group.com — dort ist unser Selbstservice-Portal.
- Bei Beschwerden/Enttäuschung: entschuldige dich, keine Ausreden, biete konkrete nächste Schritte.

**Klassifikation:** Ordne die Anfrage einer dieser Kategorien zu:
- shipping (Versand-/Lieferfragen)
- returns (Retoure/Umtausch/Reklamation)
- invoice (Rechnung/Zahlung)
- general (allgemeine Anfrage/Info)
- other (sonstiges)

**Priorität:** low, normal, high, urgent. urgent nur bei aktivem Schaden, Terminstress, oder wütendem Ton.

**Confidence:** 0.0–1.0 wie sicher du dir bei der Antwort bist. <0.6 = manuelle Prüfung nötig. >0.85 = ggf. auto-send-fähig.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in dieser Form:
{
  "category": "shipping" | "returns" | "invoice" | "general" | "other",
  "priority": "low" | "normal" | "high" | "urgent",
  "confidence": <number 0..1>,
  "reasoning": "<1-2 Sätze warum du dir sicher/unsicher bist>",
  "subject": "<Betreff für die Antwort, meist 'Re: <original>'>",
  "bodyHtml": "<HTML-Antwort, mit <p>-Tags, ohne <html>/<body>-Wrapper>"
}`;

export type AiResult = {
  category: "shipping" | "returns" | "invoice" | "general" | "other";
  priority: "low" | "normal" | "high" | "urgent";
  confidence: number;
  reasoning: string;
  subject: string;
  bodyHtml: string;
};

export async function classifyAndDraft(input: {
  subject: string;
  fromEmail: string;
  fromName: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  bodyText: string;
  ticketCode: string;
  previousMessages?: Array<{ direction: string; bodyText: string; createdAt: Date }>;
}): Promise<AiResult> {
  const c = client();

  const history = (input.previousMessages || [])
    .slice(-6) // context window
    .map(
      (m) => `[${m.direction === "inbound" ? "Kunde" : "Support"}] ${(m.bodyText || "").slice(0, 800)}`
    )
    .join("\n---\n");

  const composedName = [input.customerFirstName, input.customerLastName]
    .filter(Boolean)
    .join(" ");
  const displayName = composedName || input.fromName || input.fromEmail;
  const salutation = input.customerLastName
    ? `Sehr geehrte(r) Frau/Herr ${input.customerLastName}`
    : input.customerFirstName
      ? `Hallo ${input.customerFirstName}`
      : "Sehr geehrte Damen und Herren";

  const userMsg = [
    `Ticket-Referenz: #${input.ticketCode}`,
    `Kunde: ${displayName} <${input.fromEmail}>`,
    `Empfohlene Anrede: ${salutation}`,
    `Betreff: ${input.subject}`,
    ``,
    history ? `--- Bisheriger Verlauf ---\n${history}\n---\n` : "",
    `--- Aktuelle Nachricht ---`,
    input.bodyText.slice(0, 4000),
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
    subject: parsed.subject,
    bodyHtml: parsed.bodyHtml,
  };
}
