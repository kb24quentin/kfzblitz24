/**
 * USt-ID Validierung gegen die offizielle EU-VIES-SOAP-Schnittstelle.
 * Keine API-Keys nötig, aber rate-limited.
 *
 * Doku: https://ec.europa.eu/taxation_customs/vies/
 */

import { XMLParser } from "fast-xml-parser";

export type ViesResult =
  | {
      ok: true;
      valid: boolean;
      countryCode: string;
      vatNumber: string;
      name?: string;
      address?: string;
      requestDate?: string;
    }
  | { ok: false; error: string };

const VIES_ENDPOINT =
  "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";

/**
 * Akzeptiert Formate wie "DE123456789", "DE 123 456 789", "de123456789".
 * Liefert Country-Code + numerischen Teil oder null bei Format-Fehler.
 */
export function parseVatId(raw: string): { countryCode: string; vatNumber: string } | null {
  const clean = raw.replace(/[\s.-]/g, "").toUpperCase();
  const m = clean.match(/^([A-Z]{2})([A-Z0-9]+)$/);
  if (!m) return null;
  return { countryCode: m[1], vatNumber: m[2] };
}

export async function checkVies(rawVat: string, timeoutMs = 8000): Promise<ViesResult> {
  const parsed = parseVatId(rawVat);
  if (!parsed) {
    return { ok: false, error: "USt-ID-Format ungültig (erwartet z.B. DE123456789)" };
  }
  const { countryCode, vatNumber } = parsed;

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${countryCode}</urn:countryCode>
      <urn:vatNumber>${vatNumber}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(VIES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
      },
      body: soapBody,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `VIES HTTP ${res.status} ${res.statusText}` };
    }
    const xml = await res.text();
    return parseViesResponse(xml, countryCode, vatNumber);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "VIES Timeout" };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

function parseViesResponse(
  xml: string,
  countryCode: string,
  vatNumber: string
): ViesResult {
  try {
    const parser = new XMLParser({
      ignoreAttributes: true,
      removeNSPrefix: true,
      trimValues: true,
    });
    const doc = parser.parse(xml) as Record<string, unknown>;
    const env = (doc.Envelope ?? doc.envelope) as Record<string, unknown> | undefined;
    const body = env?.Body as Record<string, unknown> | undefined;
    // Fault path
    const fault = body?.Fault as Record<string, unknown> | undefined;
    if (fault) {
      const detail =
        (fault.faultstring as string | undefined) ??
        (fault.Faultstring as string | undefined) ??
        "VIES Fehler";
      return { ok: false, error: String(detail) };
    }
    const reply = (body?.checkVatResponse ?? body?.CheckVatResponse) as
      | Record<string, unknown>
      | undefined;
    if (!reply) {
      return { ok: false, error: "VIES: Antwort konnte nicht gelesen werden" };
    }
    const valid = String(reply.valid).toLowerCase() === "true";
    const name = (reply.name as string | undefined) || undefined;
    const address = (reply.address as string | undefined) || undefined;
    const requestDate = (reply.requestDate as string | undefined) || undefined;
    return {
      ok: true,
      valid,
      countryCode: (reply.countryCode as string | undefined) ?? countryCode,
      vatNumber: (reply.vatNumber as string | undefined) ?? vatNumber,
      name: name && name !== "---" ? name : undefined,
      address: address && address !== "---" ? address : undefined,
      requestDate,
    };
  } catch (e) {
    return {
      ok: false,
      error: `VIES parse error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Fuzzy compare two strings (normalize whitespace, case, punctuation).
 * Returns a similarity 0..1 (very rough — ok for "is this the same company").
 */
export function fuzzyMatch(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(gmbh|kg|ag|e\.?k\.?|ohg|ug|haftungsbeschr.+|co\.?|&)\b/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  // Token overlap
  const at = new Set(na.split(" "));
  const bt = new Set(nb.split(" "));
  let common = 0;
  for (const tok of at) if (bt.has(tok)) common++;
  return common / Math.max(at.size, bt.size);
}
