/**
 * POST /api/retoure/prefill — Hand-off-Endpoint für Shop-Integrationen
 *
 * Wer ruft das? Externe Shops (z.B. das Shopware-6-Plugin
 * `shopware-plugins/kb24-retoure`), die ihrem Kunden im Order-Detail
 * einen "Retoure anmelden"-Button anbieten und ihn mit vorausgefüllten
 * Daten ins kfzBlitz24-Retoure-Portal weiterleiten wollen.
 *
 * Auth: Bearer-Token (env API_TOKEN), gleich wie /api/retoure.
 *
 * Body (JSON):
 *   {
 *     orderId?: string,                                 // Shop-interne ID (Audit)
 *     bestellnummer: string,                            // PFLICHT — KB24-…
 *     customer?: {
 *       anrede?, vorname?, name?, strasse?,
 *       plz?, ort?, email?, telefon?
 *     },
 *     items?: [ { artikelnummer, menge } ],
 *     source?: string                                   // free-text (z.B. "shopware")
 *   }
 *
 * Response (200):
 *   {
 *     token: string,        // 32-stelliger cuid
 *     expiresAt: string,    // ISO-8601, 15 Min in der Zukunft
 *     url: string           // {RETOURE_PUBLIC_URL}/start?token=…
 *   }
 *
 * Pragmatik:
 *  - Wir validieren die Felder NICHT inhaltlich gegen Webisco — das
 *    macht das Frontend auf /start beim Bestätigen sowieso. Hier wird
 *    nur das Format geprüft (bestellnummer-string, plz numerisch wenn
 *    da, etc.). Ein invalider Prefill verschwendet höchstens DB-Platz
 *    bis er ausläuft.
 *  - Der Payload wird als JSON-Snapshot gespeichert (vgl. itemsJson in
 *    RetoureCase). Der Schema-Drift im Shop bleibt damit unsichtbar
 *    für unsere DB.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkBearer } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN_TTL_MINUTES = 15;
const DEFAULT_PUBLIC_URL = "https://retoure.staging.kfzblitz24-group.com";

type PrefillCustomer = {
  anrede?: string;
  vorname?: string;
  name?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  email?: string;
  telefon?: string;
};

type PrefillItem = {
  artikelnummer?: string;
  menge?: number;
};

type Body = {
  orderId?: string;
  bestellnummer?: string;
  customer?: PrefillCustomer;
  items?: PrefillItem[];
  source?: string;
};

function publicUrl(): string {
  const raw = process.env.RETOURE_PUBLIC_URL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_PUBLIC_URL).replace(/\/+$/, "");
}

/** Format-Check ohne Backend-Lookup — Inhaltliche Validierung passiert im /start-Flow. */
function validate(body: Body): string | null {
  if (!body || typeof body !== "object") return "body_invalid";
  if (typeof body.bestellnummer !== "string" || body.bestellnummer.trim() === "") {
    return "bestellnummer_required";
  }
  if (body.bestellnummer.length > 64) return "bestellnummer_too_long";

  if (body.customer) {
    if (typeof body.customer !== "object") return "customer_invalid";
    const plz = body.customer.plz;
    if (plz != null && (typeof plz !== "string" || !/^\d{4,5}$/.test(plz.trim()))) {
      // Wir akzeptieren 4- und 5-stellige PLZs (DE/AT). Wenn das später
      // strenger werden soll, hier nachziehen.
      return "customer_plz_invalid";
    }
  }

  if (body.items) {
    if (!Array.isArray(body.items)) return "items_invalid";
    for (const it of body.items) {
      if (!it || typeof it !== "object") return "items_invalid";
      if (it.artikelnummer != null && typeof it.artikelnummer !== "string") {
        return "items_artikelnummer_invalid";
      }
      if (it.menge != null && (typeof it.menge !== "number" || it.menge <= 0)) {
        return "items_menge_invalid";
      }
    }
  }

  if (body.source != null && typeof body.source !== "string") return "source_invalid";
  if (body.orderId != null && typeof body.orderId !== "string") return "orderId_invalid";

  return null;
}

export async function POST(req: Request) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized" },
      { status: auth.status }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "json_parse_failed" }, { status: 400 });
  }

  const err = validate(body);
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  // Token-Quelle bewusst getrennt von der PK: die `id` bleibt intern,
  // der `token` taucht in URLs auf. So können wir bei Bedarf Tokens
  // rotieren ohne die PK zu touchen.
  const bestellnummer = body.bestellnummer!.trim();
  const created = await prisma.retourePrefill.create({
    data: {
      token: makeToken(),
      bestellnummer,
      payloadJson: JSON.stringify({
        orderId: body.orderId ?? null,
        bestellnummer,
        customer: body.customer ?? null,
        items: body.items ?? null,
        source: body.source ?? null,
      }),
      source: body.source ?? null,
      expiresAt,
    },
    select: {
      token: true,
      expiresAt: true,
    },
  });

  const url = `${publicUrl()}/start?token=${encodeURIComponent(created.token)}`;

  return NextResponse.json({
    token: created.token,
    expiresAt: created.expiresAt.toISOString(),
    url,
  });
}

/**
 * Token-Generator. cuid-ähnlich, aber wir lehnen uns nicht auf das
 * cuid-NPM-Paket — wir nutzen crypto.randomUUID() + Date-Stempel, damit
 * Tokens kollisionsarm und ohne Extra-Dependency entstehen.
 */
function makeToken(): string {
  const rand = (globalThis.crypto?.randomUUID?.() ?? "").replace(/-/g, "");
  const ts = Date.now().toString(36);
  // 32-char-Token: 24 Zeichen Random + 8 Zeichen Timestamp-base36
  // Fallback wenn randomUUID nicht da ist (sehr alte Node-Versionen):
  // Math.random ist hier ok, weil expiresAt eine harte 15-Min-Schranke
  // setzt und der Token nur einmal nutzbar ist.
  const safe = rand.length >= 24
    ? rand.slice(0, 24)
    : Math.random().toString(36).slice(2).padEnd(24, "0").slice(0, 24);
  return `${safe}${ts.padStart(8, "0").slice(-8)}`;
}
