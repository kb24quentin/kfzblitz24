/**
 * OpenAI-basierte Checks: Gewerbeschein-OCR-Extraktion und Reputations-
 * Recherche per web_search.
 *
 * Wenn OPENAI_API_KEY nicht gesetzt ist, geben die Funktionen ein
 * "skipped" Resultat zurück — Assessment läuft weiter, nur die OpenAI-
 * Signale fehlen dann (keine Punktabzüge).
 */

import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import { fuzzyMatch } from "./vies";

// ─── OCR: Gewerbeschein → strukturierte Daten ──────────────────────────

export type GewerbescheinExtraction =
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; error: string }
  | {
      ok: true;
      data: {
        companyName?: string;
        legalForm?: string; // GmbH, KG, Einzelunternehmen, ...
        ownerName?: string;
        street?: string;
        postalCode?: string;
        city?: string;
        businessActivity?: string;
        issuingAuthority?: string;
        issueDate?: string; // YYYY-MM-DD
        registrationNumber?: string;
      };
      confidence: number; // 0..1, vom Modell selbst geschätzt
      // Übereinstimmungen mit den Formdaten
      matches: {
        companyName?: number;
        street?: number;
        postalCode?: boolean;
        city?: number;
      };
    };

export async function extractGewerbeschein(
  filePath: string,
  mimeType: string,
  formData: {
    companyName: string;
    street: string;
    postalCode: string;
    city: string;
  }
): Promise<GewerbescheinExtraction> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, skipped: true, reason: "OPENAI_API_KEY nicht gesetzt" };
  }

  try {
    const fileBuffer = await readFile(filePath);
    const base64 = fileBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const client = new OpenAI({ apiKey });

    // Single chat completion with vision input. PDF support für gpt-4o-mini
    // ist über file_id-Upload möglich; für JPG/PNG geht direkt image_url.
    // Strategie: bei PDF → wir uploaden via Files API + nutzen file_id.
    //            bei Image → direkt image_url.

    const isPdf = mimeType === "application/pdf";

    let userContent: OpenAI.Chat.ChatCompletionContentPart[] = [];
    if (isPdf) {
      // PDFs müssen wir via Files API uploaden und dann referenzieren.
      // Datei aus base64 als File-Objekt rekonstruieren.
      const blob = new Blob([fileBuffer], { type: mimeType });
      const file = new File([blob], "gewerbeschein.pdf", { type: mimeType });
      const uploaded = await client.files.create({
        file,
        purpose: "user_data",
      });
      userContent = [
        {
          type: "file",
          file: { file_id: uploaded.id },
        } as OpenAI.Chat.ChatCompletionContentPart,
        {
          type: "text",
          text: GEWERBESCHEIN_USER_PROMPT,
        },
      ];
    } else {
      userContent = [
        {
          type: "image_url",
          image_url: { url: dataUrl, detail: "high" },
        },
        {
          type: "text",
          text: GEWERBESCHEIN_USER_PROMPT,
        },
      ];
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: GEWERBESCHEIN_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "OCR-Antwort war kein gültiges JSON" };
    }

    const data = {
      companyName: str(parsed.companyName),
      legalForm: str(parsed.legalForm),
      ownerName: str(parsed.ownerName),
      street: str(parsed.street),
      postalCode: str(parsed.postalCode),
      city: str(parsed.city),
      businessActivity: str(parsed.businessActivity),
      issuingAuthority: str(parsed.issuingAuthority),
      issueDate: str(parsed.issueDate),
      registrationNumber: str(parsed.registrationNumber),
    };
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5;

    // Fuzzy-Match mit den Formdaten
    const matches = {
      companyName: fuzzyMatch(data.companyName, formData.companyName),
      street: fuzzyMatch(data.street, formData.street),
      postalCode:
        !!data.postalCode &&
        data.postalCode.replace(/\s+/g, "") === formData.postalCode.replace(/\s+/g, ""),
      city: fuzzyMatch(data.city, formData.city),
    };

    return { ok: true, data, confidence, matches };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

const GEWERBESCHEIN_SYSTEM_PROMPT = `Du bist ein präziser Daten-Extractor für deutsche Gewerbescheine. Extrahiere die strukturierten Felder aus dem Dokument und gib EXAKT folgende JSON-Struktur zurück, ohne Kommentare oder Markdown:

{
  "companyName": string | null,        // Name des Gewerbes oder Firmenname
  "legalForm": string | null,          // "GmbH", "KG", "AG", "Einzelunternehmen", "UG" usw.
  "ownerName": string | null,          // Inhaber bei Einzelgewerbe
  "street": string | null,             // Straße + Hausnummer
  "postalCode": string | null,         // PLZ, nur Ziffern
  "city": string | null,               // Ort
  "businessActivity": string | null,   // Beschreibung der Tätigkeit, z.B. "Kfz-Reparatur und Reifenservice"
  "issuingAuthority": string | null,   // Z.B. "Stadt München, Kreisverwaltungsreferat"
  "issueDate": string | null,          // ISO YYYY-MM-DD, soweit lesbar
  "registrationNumber": string | null, // Gewerbe-/Registernummer, soweit ausgewiesen
  "confidence": number                 // 0..1, deine Einschätzung der Lesbarkeit/Vollständigkeit
}

Wenn ein Feld nicht lesbar oder nicht vorhanden ist: null. Niemals raten. Niemals Felder erfinden.`;

const GEWERBESCHEIN_USER_PROMPT = `Bitte extrahiere die Felder aus diesem Gewerbeschein. Gib NUR das JSON zurück, kein zusätzlicher Text.`;

// ─── Reputations-Recherche per web_search ──────────────────────────────

export type ReputationResearch =
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; error: string }
  | {
      ok: true;
      verdict: "legitimate" | "uncertain" | "suspicious";
      summary: string; // Kurze Begründung, 1-3 Sätze
      signals: {
        hasWebsite?: boolean;
        hasReviews?: boolean;
        averageRating?: number; // 1..5 falls eindeutig
        positiveSignals: string[];
        redFlags: string[];
      };
      sources: { title: string; url: string }[];
    };

export async function researchCompany(args: {
  companyName: string;
  city: string;
  postalCode: string;
  street: string;
  customerType: string;
}): Promise<ReputationResearch> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, skipped: true, reason: "OPENAI_API_KEY nicht gesetzt" };
  }

  try {
    const client = new OpenAI({ apiKey });

    const input = `Recherchiere folgende deutsche Firma im Web und schätze ihre Legitimität ein:

Firma: "${args.companyName}"
Adresse: ${args.street}, ${args.postalCode} ${args.city}, Deutschland
Branche: ${args.customerType === "werkstatt" ? "Kfz-Werkstatt / Reifenservice / Karosseriebau" : "Online-Shop / Großhandel / Einzelhandel"}

Prüfe:
- Findest du eine offizielle Webseite oder einen Online-Shop?
- Findest du Bewertungen (Google, Trustpilot, Branchenbuch, etc.)?
- Wirken die Bewertungen authentisch und positiv?
- Gibt es Warnhinweise, Abmahnungen, Insolvenzmeldungen, oder Berichte von Betrug/unzufriedenen Kunden?
- Stimmt die Adresse mit dem überein, was im Web zu finden ist?

WICHTIG: Antworte am Ende AUSSCHLIESSLICH mit einem JSON-Objekt zwischen den Markern
<<<JSON>>> und <<<END>>>. KEIN Text danach. Genau diese Struktur:

<<<JSON>>>
{
  "verdict": "legitimate" | "uncertain" | "suspicious",
  "summary": "1-3 Sätze Zusammenfassung der Recherche",
  "signals": {
    "hasWebsite": true|false|null,
    "hasReviews": true|false|null,
    "averageRating": number|null,
    "positiveSignals": ["..."],
    "redFlags": ["..."]
  },
  "sources": [{"title": "...", "url": "https://..."}]
}
<<<END>>>`;

    // Responses API mit web_search Tool — JSON-Mode ist mit web_search
    // NICHT erlaubt, deshalb über Marker-Delimiter parsen.
    const resp = await client.responses.create({
      model: "gpt-4.1",
      input,
      tools: [{ type: "web_search_preview" }],
    });

    const text = resp.output_text ?? "";
    // Marker-Block extrahieren, fallback: ersten {…} JSON-Block finden
    let jsonStr = "";
    const markerMatch = text.match(/<<<JSON>>>([\s\S]*?)<<<END>>>/);
    if (markerMatch) {
      jsonStr = markerMatch[1].trim();
    } else {
      const fenceMatch = text.match(/```json\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      } else {
        const braceStart = text.indexOf("{");
        const braceEnd = text.lastIndexOf("}");
        if (braceStart >= 0 && braceEnd > braceStart) {
          jsonStr = text.slice(braceStart, braceEnd + 1);
        }
      }
    }
    if (!jsonStr) {
      return { ok: false, error: "Reputation-Antwort enthielt kein JSON" };
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      return {
        ok: false,
        error: `Reputation-Antwort war kein gültiges JSON: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    const verdictRaw = String(parsed.verdict ?? "").toLowerCase();
    const verdict: "legitimate" | "uncertain" | "suspicious" =
      verdictRaw === "legitimate"
        ? "legitimate"
        : verdictRaw === "suspicious"
        ? "suspicious"
        : "uncertain";

    const signalsObj = (parsed.signals as Record<string, unknown>) ?? {};
    const sourcesArr = Array.isArray(parsed.sources) ? parsed.sources : [];

    return {
      ok: true,
      verdict,
      summary: String(parsed.summary ?? ""),
      signals: {
        hasWebsite:
          typeof signalsObj.hasWebsite === "boolean"
            ? signalsObj.hasWebsite
            : undefined,
        hasReviews:
          typeof signalsObj.hasReviews === "boolean"
            ? signalsObj.hasReviews
            : undefined,
        averageRating:
          typeof signalsObj.averageRating === "number"
            ? signalsObj.averageRating
            : undefined,
        positiveSignals: Array.isArray(signalsObj.positiveSignals)
          ? (signalsObj.positiveSignals as unknown[]).map(String)
          : [],
        redFlags: Array.isArray(signalsObj.redFlags)
          ? (signalsObj.redFlags as unknown[]).map(String)
          : [],
      },
      sources: sourcesArr
        .map((s) => {
          const item = s as Record<string, unknown>;
          return { title: String(item.title ?? ""), url: String(item.url ?? "") };
        })
        .filter((s) => s.url),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
