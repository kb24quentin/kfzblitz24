/**
 * Consumer for the internal retoure order-lookup endpoint. Handles auth,
 * caching, and the datenschutz-guard: only surface order data when the
 * ticket contact email matches one of the beleg addresses (or was set
 * manually by an agent — see `lookupOrder({trustEmail:true})`).
 */

type BelegAddress = {
  vorname?: string;
  name?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  email?: string;
};

type BelegPosition = {
  id?: number;
  typ?: string;
  artikelnummer?: string;
  hersteller?: string;
  beschreibung?: string;
  menge?: number;
  einzelpreis_brutto?: number;
  positionspreis_brutto?: number;
  status?: string;
  lieferdatum?: string;
  offene_gutschriftsmenge?: number;
};

export type Beleg = {
  typ: string;
  id: number;
  belegnummer?: string;
  belegdatum?: string;
  status?: string;
  bestellnummer?: string;
  bestellername?: string;
  endpreis_brutto?: number;
  endpreis_netto?: number;
  rechnungsadresse?: BelegAddress;
  lieferadresse?: BelegAddress;
  positionen?: BelegPosition[];
};

export type LookupResult =
  | { ok: true; beleg: Beleg; mode: "demo" | "live" }
  | { ok: false; error: string };

// In-memory cache — process-wide, TTL 60s. Prevents duplicate lookups in the
// same request/gmail-poll cycle. Container restart clears it, which is fine.
const _cache = new Map<string, { at: number; result: LookupResult }>();
const CACHE_TTL_MS = 60_000;

function getBase(): string | null {
  return (process.env.RETOURE_API_URL || "").replace(/\/+$/, "") || null;
}

function getToken(): string | null {
  return process.env.RETOURE_API_TOKEN?.trim() || null;
}

export function isLookupConfigured(): boolean {
  return !!getBase() && !!getToken();
}

export async function lookupOrder(bestellnummer: string): Promise<LookupResult> {
  const key = bestellnummer.trim();
  if (!key) return { ok: false, error: "empty" };

  const cached = _cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.result;
  }

  const base = getBase();
  const token = getToken();
  if (!base || !token) {
    return { ok: false, error: "lookup_not_configured" };
  }

  let response: Response;
  try {
    response = await fetch(`${base}/api/orders/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: `fetch_failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (response.status === 404) {
    const result: LookupResult = { ok: false, error: "not_found" };
    _cache.set(key, { at: Date.now(), result });
    return result;
  }

  if (!response.ok) {
    return { ok: false, error: `http_${response.status}` };
  }

  const json = (await response.json()) as {
    ok: boolean;
    beleg?: Beleg;
    mode?: "demo" | "live";
    error?: string;
  };

  if (!json.ok || !json.beleg) {
    return { ok: false, error: json.error || "malformed_response" };
  }

  const result: LookupResult = { ok: true, beleg: json.beleg, mode: json.mode ?? "live" };
  _cache.set(key, { at: Date.now(), result });
  return result;
}

/**
 * Case-insensitive comparison of the ticket contact email against the beleg
 * customer addresses. Prevents pulling in someone else's order just because
 * they happened to email in about it.
 */
export function belegEmailMatches(beleg: Beleg, contactEmail: string): boolean {
  const target = contactEmail.trim().toLowerCase();
  if (!target) return false;
  const candidates = [beleg.rechnungsadresse?.email, beleg.lieferadresse?.email]
    .filter(Boolean)
    .map((e) => (e as string).trim().toLowerCase());
  return candidates.includes(target);
}

/**
 * Extracts unique KB24-style order numbers from freeform text. Accepts both
 * "KB24-73627372300" and "KB24 73627372300" (customers often paste with
 * whitespace variations).
 */
export function extractOrderNumbers(text: string): string[] {
  if (!text) return [];
  const rx = /KB24[-\s]?(\d{6,15})/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    seen.add(`KB24-${m[1]}`);
  }
  return Array.from(seen);
}

/** Position-Typen die auf dem Beleg stehen aber KEINE physischen retour-baren
 * Artikel sind (Versandkosten, Rabatte, Textzeilen, Gutschriften). Alles andere
 * — inkl. Pfand — ist grundsätzlich retourfähig aus Support-Sicht. */
const NON_RETURNABLE_TYPES = new Set([
  "versand",
  "zustellung",
  "rabatt",
  "textposition",
  "gutschrift",
]);

export function isReturnablePosition(p: BelegPosition): boolean {
  const t = (p.typ ?? "artikel").toLowerCase();
  if (NON_RETURNABLE_TYPES.has(t)) return false;
  if (p.status === "geliefertstreckengeschaeft") return false;
  const menge = p.offene_gutschriftsmenge && p.offene_gutschriftsmenge > 0
    ? p.offene_gutschriftsmenge
    : Math.abs(p.menge ?? 0);
  return menge > 0;
}

/** Erkennt "Sichere Rückgabe" / "Rückgabe+" via Zustellungs-Position mit
 *  entsprechendem Keyword. Passt zur Logik in retoure/src/lib/shipping.ts. */
const SICHERE_RUECKGABE_KEYWORDS = [
  "sichere rückgabe",
  "sichere rueckgabe",
  "gratis rücksendung",
  "gratis ruecksendung",
  "rückgabe+",
  "rueckgabe+",
];

export function hasSichereRueckgabe(beleg: Beleg): boolean {
  const zustellungen = (beleg.positionen ?? []).filter(
    (p) => (p.typ ?? "").toLowerCase() === "zustellung",
  );
  return zustellungen.some((z) => {
    const label = (z.beschreibung ?? "").toLowerCase();
    return SICHERE_RUECKGABE_KEYWORDS.some((k) => label.includes(k));
  });
}

/** Effektives Zustellungsdatum: neuestes lieferdatum aus Positionen, sonst
 *  belegdatum als Fallback. Null wenn beides fehlt. */
export function belegDeliveryDate(beleg: Beleg): Date | null {
  const dates = (beleg.positionen ?? [])
    .map((p) => p.lieferdatum)
    .filter((s): s is string => !!s)
    .map((s) => new Date(s))
    .filter((d) => !isNaN(d.getTime()));
  if (dates.length > 0) return new Date(Math.max(...dates.map((d) => d.getTime())));
  return beleg.belegdatum ? new Date(beleg.belegdatum) : null;
}

/**
 * Compact display snapshot for the AI prompt + sidebar. Keeps positions to
 * top 8 to bound prompt size.
 */
export function summarizeBeleg(beleg: Beleg): string {
  const total =
    typeof beleg.endpreis_brutto === "number"
      ? `${beleg.endpreis_brutto.toFixed(2).replace(".", ",")} € brutto`
      : "—";
  const status = beleg.status || "unbekannt";
  const positions = (beleg.positionen || []).slice(0, 8).map((p) => {
    const parts = [
      p.hersteller,
      p.artikelnummer,
      p.beschreibung ? p.beschreibung.slice(0, 60) : null,
      typeof p.menge === "number" ? `${p.menge}x` : null,
    ].filter(Boolean);
    return `  - ${parts.join(" · ")}`;
  });
  const positionOverflow = (beleg.positionen?.length ?? 0) > 8 ? `\n  … +${(beleg.positionen?.length ?? 0) - 8} weitere` : "";
  const addr = beleg.lieferadresse || beleg.rechnungsadresse;
  const addressLine = addr
    ? `${addr.vorname ?? ""} ${addr.name ?? ""}, ${addr.strasse ?? ""}, ${addr.plz ?? ""} ${addr.ort ?? ""}, ${addr.land ?? ""}`
        .replace(/\s+/g, " ")
        .trim()
    : "—";
  return [
    `Bestellnummer: ${beleg.bestellnummer ?? "—"}`,
    `Belegdatum: ${beleg.belegdatum ?? "—"}`,
    `Status: ${status}`,
    `Gesamt: ${total}`,
    `Lieferadresse: ${addressLine}`,
    positions.length > 0 ? `Positionen:\n${positions.join("\n")}${positionOverflow}` : "Positionen: —",
  ].join("\n");
}
