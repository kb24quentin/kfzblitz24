/**
 * OpenAI-Vision-Scoring eines RetoureItem-Fotos.
 *
 * Wir rufen `gpt-4o-mini` mit der Chat-Completions-API direkt via fetch
 * auf (kein npm-Paket — bewusst, der Retoure-Service zieht sonst keinen
 * OpenAI-Client). Das Bild wird als base64-Data-URL an die `image_url`-
 * Content-Part angehängt.
 *
 * Antwortvertrag (deutsch):
 *   { "score": 0..100, "reasoning": "kurzer Satz", "confidence": 0..1 }
 *
 * Falls `OPENAI_API_KEY` fehlt, skippen wir komplett — das Item bleibt
 * dann ohne AI-Score und der Verdict basiert allein auf der Mitarbeiter-
 * Einschätzung.
 */
import fs from "node:fs/promises";

const MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type ScorePhotoOk = {
  ok: true;
  score: number; // 0..100
  reasoning: string;
  confidence: number; // 0..1
};

export type ScorePhotoErr = {
  ok: false;
  error: string;
  skipped?: boolean;
};

export type ScorePhotoResult = ScorePhotoOk | ScorePhotoErr;

export interface ScorePhotoOpts {
  beschreibung?: string;
  grund?: string;
}

/**
 * Bewertet ein einzelnes Foto. Liest die Datei selbst, codiert sie als
 * base64 und schickt sie an OpenAI. Bei Netz-/API-Fehlern returnen wir
 * ein Error-Result; der Aufrufer kann dann entscheiden, ob er retried
 * oder das Foto unbewertet lässt.
 */
export async function scorePhoto(
  absPath: string,
  mimeType: string,
  opts: ScorePhotoOpts = {}
): Promise<ScorePhotoResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY nicht gesetzt", skipped: true };
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(absPath);
  } catch (e) {
    return {
      ok: false,
      error: `Foto-Datei nicht lesbar: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const b64 = buf.toString("base64");
  const dataUrl = `data:${mimeType};base64,${b64}`;

  const contextLines: string[] = [];
  if (opts.beschreibung) contextLines.push(`Artikel: ${opts.beschreibung}`);
  if (opts.grund) contextLines.push(`Retoure-Grund vom Kunden: ${opts.grund}`);
  const contextBlock =
    contextLines.length > 0 ? `\n\nKontext:\n${contextLines.join("\n")}` : "";

  const systemPrompt =
    "Du bist ein erfahrener Retouren-Prüfer eines KFZ-Teile-Händlers. " +
    "Du bewertest den Wiederverkaufs-Zustand eines Artikels anhand eines Fotos. " +
    "Achte auf: sichtbare Beschädigung am Artikel, Zustand der Verpackung (OVP " +
    "vorhanden/intakt/beschädigt), Vollständigkeit (fehlt etwas, Zubehör?), " +
    "Gebrauchsspuren, Verschmutzung. Antworte AUSSCHLIESSLICH in JSON mit den " +
    "Feldern score (Ganzzahl 0–100, wobei 0=Müll/unverkäuflich, 50=Mängel " +
    "sichtbar, 85=guter Zustand, 100=neuwertig/OVP), reasoning (1 kurzer Satz auf " +
    "Deutsch, max 200 Zeichen) und confidence (0..1, wie sicher du dir bist " +
    "basierend auf Bildqualität/Sichtbarkeit). Kein zusätzlicher Text, nur JSON.";

  const userPrompt =
    "Bitte bewerte den Wiederverkaufs-Zustand des Artikels auf diesem Foto." +
    contextBlock;

  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        max_tokens: 300,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: `OpenAI-Request fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return {
      ok: false,
      error: `OpenAI HTTP ${res.status}: ${txt.slice(0, 300)}`,
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    return {
      ok: false,
      error: `OpenAI-Response kein JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const content = extractContent(json);
  if (!content) {
    return { ok: false, error: "OpenAI-Response ohne Content" };
  }

  let parsed: { score?: unknown; reasoning?: unknown; confidence?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      ok: false,
      error: `Model-Output kein JSON: ${content.slice(0, 200)}`,
    };
  }

  const scoreRaw = Number(parsed.score);
  const confRaw = Number(parsed.confidence);
  if (!Number.isFinite(scoreRaw) || !Number.isFinite(confRaw)) {
    return {
      ok: false,
      error: `Model-Output ohne score/confidence: ${content.slice(0, 200)}`,
    };
  }
  const score = clamp(Math.round(scoreRaw), 0, 100);
  const confidence = clamp(confRaw, 0, 1);
  const reasoning =
    typeof parsed.reasoning === "string"
      ? parsed.reasoning.slice(0, 300)
      : "";

  return { ok: true, score, reasoning, confidence };
}

function extractContent(json: unknown): string | null {
  const choices = (json as { choices?: Array<{ message?: { content?: unknown } }> })
    ?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const c = choices[0]?.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    // multimodal-Form, falls OpenAI mal Arrays zurückgibt
    const parts = c
      .map((p) => (p && typeof (p as { text?: unknown }).text === "string"
        ? (p as { text: string }).text
        : null))
      .filter(Boolean) as string[];
    return parts.join("\n");
  }
  return null;
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/**
 * Helper: konstanter Modellname, wird im aiAnalysisJson persistiert.
 */
export const AI_PHOTO_MODEL = MODEL;
