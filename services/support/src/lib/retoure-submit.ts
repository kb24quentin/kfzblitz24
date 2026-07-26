/**
 * Client wrapper for the Retoure service's POST /api/retoure/submit endpoint.
 * Used by the Support ticket UI to create a customer return from within the
 * ticket context. Auth via RETOURE_API_TOKEN (shared bearer, same as lookup).
 */

export type RetoureSubmitItem = {
  artikelnummer: string;
  menge: number;
  grund_code: string;
  grund_freitext?: string;
  hersteller: string;
  beschreibung: string;
  einzelpreis_brutto: number;
};

export type RetoureSubmitPayload = {
  bestellnummer: string;
  source: "direct";
  kategorie: "widerruf" | "gewaehrleistung";
  customer: {
    anrede?: string;
    vorname?: string;
    name?: string;
    strasse?: string;
    plz?: string;
    ort?: string;
    land?: string;
    email: string;
    telefon?: string;
  };
  items: RetoureSubmitItem[];
  label_requested: boolean;
  premium_return?: {
    active: boolean;
    frist_tage: 14 | 30;
    free_label: boolean;
  };
};

export type RetoureSubmitResult =
  | {
      ok: true;
      caseId: string;
      status: string;
      createdAt: string;
      eligibleUntil: string | null;
      shippingLabel: {
        provider?: string;
        trackingNumber?: string;
        labelPdfUrl?: string;
        fee?: number;
      } | null;
      retoureAnmeldungPdfUrl: string;
      publicUrl: string;
    }
  | { ok: false; error: string; status?: number };

function base(): string | null {
  return (process.env.RETOURE_API_URL || "").replace(/\/+$/, "") || null;
}
function token(): string | null {
  return process.env.RETOURE_API_TOKEN?.trim() || null;
}

export function isRetoureConfigured(): boolean {
  return !!base() && !!token();
}

export async function submitRetoure(payload: RetoureSubmitPayload): Promise<RetoureSubmitResult> {
  const b = base();
  const t = token();
  if (!b || !t) return { ok: false, error: "retoure_not_configured" };

  let response: Response;
  try {
    response = await fetch(`${b}/api/retoure/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: `fetch_failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: `http_${response.status}_non_json` };
  }

  if (!response.ok) {
    const j = json as {
      error?: string;
      reason?: string;
      errors?: unknown;
      existingCases?: Array<{ id: string; status: string; createdAt: string }>;
    };
    const err = j?.error || "unknown_error";
    // Ehrliche menschen-lesbare übersetzung häufiger reasons
    const humanReason: Record<string, string> = {
      not_eligible: "Retoure aktuell nicht möglich",
      already_open_case: "Für diese Bestellnummer existiert bereits ein offener Retoure-Case im RMA-System",
      frist_abgelaufen: "14-Tage-Widerrufsfrist ist abgelaufen (ab Zustellungsdatum)",
      order_not_found: "Bestellnummer nicht gefunden",
      no_delivery_yet: "Bestellung wurde noch nicht ausgeliefert",
      b2b_no_widerruf: "B2B-Kunden haben kein Widerrufsrecht — Gewährleistungs-Retoure verwenden",
      validation_failed: "Validierungsfehler in den übergebenen Item-Daten",
    };
    const reason = j.reason || err;
    const label = humanReason[reason] ?? reason;
    const extra = j.existingCases && j.existingCases.length > 0
      ? ` (offener Case: ${j.existingCases[0].id}, angelegt ${new Date(j.existingCases[0].createdAt).toLocaleString("de-DE")})`
      : "";
    return {
      ok: false,
      status: response.status,
      error: `${label}${extra}${
        j.errors ? ` — Details: ${JSON.stringify(j.errors)}` : ""
      }`,
    };
  }

  const j = json as {
    caseId: string;
    status: string;
    createdAt: string;
    eligibleUntil: string | null;
    shippingLabel: {
      provider?: string;
      trackingNumber?: string;
      labelPdfUrl?: string;
      fee?: number;
    } | null;
    retoureAnmeldungPdfUrl: string;
  };

  return {
    ok: true,
    caseId: j.caseId,
    status: j.status,
    createdAt: j.createdAt,
    eligibleUntil: j.eligibleUntil,
    shippingLabel: j.shippingLabel,
    retoureAnmeldungPdfUrl: j.retoureAnmeldungPdfUrl,
    publicUrl: `${b}/case/${j.caseId}`,
  };
}
