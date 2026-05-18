/**
 * Minimal dodajpaczke.eu API client — used to generate DHL Retoure
 * labels for our customers.
 *
 * Auth flow:
 *   1. POST /users/authentication (login + password as form-urlencoded)
 *   2. → { data: { accessToken, expirationDate } }
 *   3. Use accessToken as Bearer for subsequent calls
 *
 * Retoure label flow:
 *   1. POST /shipments?sync=1 with { provider:{id:36}, shipperId, item, receiver }
 *   2. Response (sync) contains shipments[].shipment.id
 *   3. GET /shipments/{id}/retoureLabel
 *   4. → { data: { file: base64, name, extension, mimeType } }
 *
 * Provider IDs we care about: 36 = DHL Retoure (DE), 33 = B2C Free
 * (B2C Free was removed in v1.9 for DHL Intl).
 */

const DEFAULT_BASE_URL = "https://api.dodajpaczke.eu/v1";

export interface DodajpaczkeConfig {
  baseUrl: string;
  login: string;
  password: string;
  /** Numerischer Shipper-ID Wert, von dodajpaczke pro Adresse vergeben. */
  shipperId: number;
  /** Empfänger der Retoure (unsere Warehouse). */
  warehouseName: string;
  warehouseZip: string;
  /** Netto-Labelkosten, die ggf. der Erstattung abgezogen werden. */
  labelFeeNet: number;
}

export function getDodajpaczkeConfig(): DodajpaczkeConfig | null {
  const login = process.env.DODAJPACZKE_LOGIN?.trim();
  const password = process.env.DODAJPACZKE_PASSWORD?.trim();
  const shipperIdRaw = process.env.DODAJPACZKE_SHIPPER_ID?.trim();
  if (!login || !password || !shipperIdRaw) return null;
  const shipperId = Number(shipperIdRaw);
  if (!Number.isFinite(shipperId)) return null;
  return {
    baseUrl: (process.env.DODAJPACZKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    login,
    password,
    shipperId,
    warehouseName: process.env.DODAJPACZKE_WAREHOUSE_NAME?.trim() || "kfzBlitz24 GmbH",
    warehouseZip: process.env.DODAJPACZKE_WAREHOUSE_ZIP?.trim() || "12345",
    labelFeeNet: Number(process.env.DODAJPACZKE_LABEL_FEE_NET ?? "4.62"),
  };
}

// ─── Token cache ───────────────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(cfg: DodajpaczkeConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }
  const params = new URLSearchParams();
  params.set("login", cfg.login);
  params.set("password", cfg.password);
  const res = await fetch(`${cfg.baseUrl}/users/authentication`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`dodajpaczke auth HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: { accessToken?: string; expirationDate?: string };
    error?: string;
  };
  if (json.error || !json.data?.accessToken) {
    throw new Error(`dodajpaczke auth error: ${json.error ?? "no token in response"}`);
  }
  const expDate = json.data.expirationDate
    ? Date.parse(json.data.expirationDate)
    : now + 60 * 60 * 1000; // 1h default
  cachedToken = {
    token: json.data.accessToken,
    expiresAt: Number.isFinite(expDate) ? expDate : now + 60 * 60 * 1000,
  };
  return cachedToken.token;
}

// ─── API helpers ───────────────────────────────────────────────────────
async function authedFetch(
  cfg: DodajpaczkeConfig,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getToken(cfg);
  const headers = new Headers(init?.headers);
  // ⚠ dodajpaczke erwartet den Token RAW im Authorization-Header, OHNE
  // "Bearer"-Prefix. Anders als bei den meisten REST-APIs üblich, sonst 403.
  headers.set("Authorization", token);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(`${cfg.baseUrl}${path}`, { ...init, headers, cache: "no-store" });
}

// ─── Retoure shipment + label ──────────────────────────────────────────

export type RetoureLabelResult =
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; error: string }
  | {
      ok: true;
      shipmentId: number;
      trackingNumber?: string;
      retoureIdc?: string;
      pdfBuffer: Buffer;
      mimeType: string;
      filename: string;
    };

export interface CustomerForReceiver {
  salutation?: string; // "Herr" | "Frau"
  firstname?: string;
  lastname?: string;
  companyName?: string;
  streetName?: string;
  streetNumber?: string;
  zipNumber?: string;
  city?: string;
  countryISOCode?: string; // default "DE"
  email?: string;
  phone?: string; // Festnetz
  mobile?: string; // Handy
}

export interface CreateRetoureOptions {
  /** Gewicht in kg, default 1. DHL Retoure-Label akzeptiert flexible Werte. */
  weightInKg?: number;
  /** Optionale Kundenreferenz — z.B. unsere Bestellnummer. */
  customerReference?: string;
  /** Optionaler Freitext / Beschreibung. */
  description?: string;
  /**
   * Kundendaten für den Receiver des Retoure-Labels.
   * In dodajpaczke-Retoure-Semantik (Provider 36) ist der "receiver"
   * derjenige, der die Sendung verschickt — also der Kunde, dessen
   * Adresse auf dem Label als Absender erscheint.
   */
  customer?: CustomerForReceiver;
}

/** Versucht "Hauptstraße 5a" → ["Hauptstraße", "5a"] zu splitten. */
function splitStreet(raw: string | undefined): { streetName?: string; streetNumber?: string } {
  if (!raw) return {};
  const trimmed = raw.trim();
  const m = trimmed.match(/^(.+?)\s+(\d+[a-zA-Z\-/]*\d*)\s*$/);
  if (m) return { streetName: m[1].trim(), streetNumber: m[2].trim() };
  return { streetName: trimmed };
}

/**
 * Erzeugt eine Retoure-Sendung bei dodajpaczke (DHL Retoure, Provider 36)
 * und holt direkt das Retoure-Label-PDF.
 *
 * Wenn die Config fehlt, wird ein `skipped`-Resultat zurückgegeben —
 * der Aufrufer kann dann demo-mäßig weitermachen.
 */
export async function createRetoureLabel(
  opts: CreateRetoureOptions = {}
): Promise<RetoureLabelResult> {
  const cfg = getDodajpaczkeConfig();
  if (!cfg) {
    return {
      ok: false,
      skipped: true,
      reason:
        "DODAJPACZKE_LOGIN / DODAJPACZKE_PASSWORD / DODAJPACZKE_SHIPPER_ID nicht konfiguriert.",
    };
  }

  // Schritt 1: Sendung anlegen (sync=1 → wir kriegen die ID direkt zurück)
  // ──────────────────────────────────────────────────────────────────────
  // Receiver-Logik:
  // • Kundendaten vorhanden → echte Kunden-Adresse auf das Label
  // • Sonst → Fallback auf Warehouse (zeigt N/A; nicht ideal aber erlaubt)
  let receiverBlock: Record<string, unknown>;
  if (opts.customer) {
    const c = opts.customer;
    const fullName = [c.firstname, c.lastname].filter(Boolean).join(" ").trim();
    // Wenn echter Firmenname existiert: companyName + ggf. contactPerson;
    // sonst: type=company mit fullName als companyName (person-Typ ist deprecated)
    const companyName = c.companyName?.trim() || fullName || "Kunde";
    const street = splitStreet(
      // Falls separat übergeben, nimm direkt; sonst aus streetName extrahieren
      c.streetName && c.streetNumber
        ? `${c.streetName} ${c.streetNumber}`
        : c.streetName
    );
    receiverBlock = {
      type: "company",
      companyName,
      identityAddress: {
        streetName: c.streetName ?? street.streetName ?? "N/A",
        streetNumber: c.streetNumber ?? street.streetNumber ?? "",
        zipNumber: c.zipNumber ?? cfg.warehouseZip,
        city: c.city ?? "",
        originCountryISOCode: c.countryISOCode ?? "DE",
      },
      identityCommunication: {
        contactPerson: fullName || "",
        email: c.email ?? "",
        // DHL braucht mind. eine Telefonnummer — fülle phone immer wenn
        // wir irgendeine Nummer haben (Festnetz ODER Handy), und
        // dupliziere ins mobile-Feld wenn handy bekannt.
        phone: c.phone || c.mobile || "",
        mobile: c.mobile || "",
      },
    };
  } else {
    receiverBlock = {
      type: "company",
      companyName: cfg.warehouseName,
      identityAddress: {
        originCountryISOCode: "DE",
        zipNumber: cfg.warehouseZip,
      },
    };
  }

  const payload = {
    shipments: [
      {
        provider: { id: 36 }, // DHL Retoure
        shipperId: cfg.shipperId,
        ...(opts.customerReference ? { customerReference: opts.customerReference } : {}),
        ...(opts.description ? { description: opts.description } : {}),
        item: {
          weightInKg: opts.weightInKg ?? 1,
          packageType: "PK",
        },
        receiver: receiverBlock,
      },
    ],
  };

  let createRes: Response;
  try {
    createRes = await authedFetch(cfg, "/shipments?sync=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { ok: false, error: `dodajpaczke createShipment network: ${stringErr(e)}` };
  }
  if (!createRes.ok) {
    const txt = await createRes.text().catch(() => "");
    return {
      ok: false,
      error: `dodajpaczke createShipment HTTP ${createRes.status}: ${txt.slice(0, 200)}`,
    };
  }
  const createJson = (await createRes.json()) as {
    data?: {
      shipments?: Array<{
        shipment?: {
          id?: number;
          trackingNumber?: string;
          retoureIdc?: string;
        };
        error?: string;
      }>;
    };
    error?: string;
  };
  if (createJson.error) {
    return { ok: false, error: `dodajpaczke: ${createJson.error}` };
  }
  const first = createJson.data?.shipments?.[0];
  if (first?.error) {
    return { ok: false, error: `dodajpaczke shipment error: ${first.error}` };
  }
  const shipmentId = first?.shipment?.id;
  if (!shipmentId) {
    return {
      ok: false,
      error: "dodajpaczke: kein shipmentId in Antwort (sync=1 hat nicht geklappt?)",
    };
  }

  const trackingNumber = first?.shipment?.trackingNumber;
  const retoureIdc = first?.shipment?.retoureIdc;

  // Schritt 2: Label abholen.
  // Für DHL-Retoure-Sendungen (Provider 36 — angelegt mit createShipment)
  // ist /shippingLabel das richtige Endpoint. /retoureLabel dagegen ist für
  // "ich habe eine bestehende Versand-Sendung und will nachträglich eine
  // Retoure draufpacken". Bei reinen Retoure-Sendungen wäre /retoureLabel
  // 404 — daher: erst shippingLabel versuchen, dann als Fallback retoureLabel.
  let labelRes: Response;
  try {
    labelRes = await authedFetch(cfg, `/shipments/${shipmentId}/shippingLabel`);
    if (labelRes.status === 404) {
      labelRes = await authedFetch(cfg, `/shipments/${shipmentId}/retoureLabel`);
    }
  } catch (e) {
    return { ok: false, error: `dodajpaczke label network: ${stringErr(e)}` };
  }
  if (!labelRes.ok) {
    const txt = await labelRes.text().catch(() => "");
    return {
      ok: false,
      error: `dodajpaczke label HTTP ${labelRes.status}: ${txt.slice(0, 200)}`,
    };
  }
  const labelJson = (await labelRes.json()) as {
    data?: { file?: string; name?: string; extension?: string; mimeType?: string };
    error?: string;
  };
  if (labelJson.error || !labelJson.data?.file) {
    return {
      ok: false,
      error: `dodajpaczke label: ${labelJson.error ?? "kein file in Antwort"}`,
    };
  }

  const pdfBuffer = Buffer.from(labelJson.data.file.replace(/\s+/g, ""), "base64");
  if (pdfBuffer.length < 200) {
    return { ok: false, error: "dodajpaczke retoureLabel: leeres PDF" };
  }

  return {
    ok: true,
    shipmentId,
    trackingNumber,
    retoureIdc,
    pdfBuffer,
    mimeType: labelJson.data.mimeType ?? "application/pdf",
    filename: labelJson.data.name ?? `retoure-${shipmentId}.pdf`,
  };
}

function stringErr(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
