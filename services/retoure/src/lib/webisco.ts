/**
 * Minimal Webisco client (protocol v21).
 *
 * IMPORTANT legal note: the Webisco spec restricts the protocol to CLIENT
 * implementations. For server-side use, Abisco explicitly requires their
 * "Abisco-Connect" interface. This module is intentionally a THIN wrapper
 * for a technical proof-of-concept — do not ship it to customers without
 * a proper license agreement in place.
 */

import { XMLParser } from "fast-xml-parser";

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────
export interface WebiscoConfig {
  host: string; // e.g. "http://webisco.internal.kfzblitz24.de:8228"
  username: string;
  password?: string;
  adminid?: string; // if set, server skips customer password validation
  version?: number; // defaults to 21
}

export interface BelegPosition {
  id: number;
  typ: string;
  artikelnummer?: string;
  hersteller?: string;
  herstellernummer?: string;
  beschreibung?: string;
  menge?: number;
  einzelpreis_netto?: number;
  einzelpreis_brutto?: number;
  positionspreis_netto?: number;
  positionspreis_brutto?: number;
  status?: string;
  bestelldatum?: string;
  lieferdatum?: string;
  rechnungsdatum?: string;
  offene_gutschriftsmenge?: number;
  einzelgewicht?: number;
}

export interface Adresse {
  anrede?: string;
  vorname?: string;
  name?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  email?: string;
  telefon?: string;
  handy?: string;
}

export interface Beleg {
  typ: string;
  id: number;
  belegnummer?: string;
  belegdatum?: string;
  status?: string;
  bestellnummer?: string;
  bestellername?: string;
  kundennummer?: number;
  endpreis_netto?: number;
  endpreis_brutto?: number;
  erstellt?: string;
  mitarbeiter?: string;
  rechnungsadresse?: Adresse;
  lieferadresse?: Adresse;
  positionen: BelegPosition[];
}

export interface WebiscoError {
  ok: false;
  error: string;
}

export interface WebiscoSuccess<T> {
  ok: true;
  data: T;
}

export type WebiscoResult<T> = WebiscoSuccess<T> | WebiscoError;

// ────────────────────────────────────────────────────────────────────────
// Client
// ────────────────────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildEnvelope(cfg: WebiscoConfig, innerXml: string): string {
  const version = cfg.version ?? 21;
  const attrs: string[] = [
    `version="${version}"`,
    `username="${xmlEscape(cfg.username)}"`,
  ];
  if (cfg.adminid) {
    attrs.push(`adminid="${xmlEscape(cfg.adminid)}"`);
  }
  // password is only required when no admin-id is set, but Webisco still
  // accepts an (empty) password attribute alongside adminid without error.
  attrs.push(`password="${xmlEscape(cfg.password ?? "")}"`);
  attrs.push(`type="request"`);
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<webisco ${attrs.join(" ")}>\n` +
    `<content>${innerXml}</content>\n` +
    `</webisco>`
  );
}

async function callWebisco(
  cfg: WebiscoConfig,
  resource: string,
  innerXml: string
): Promise<string> {
  const body = buildEnvelope(cfg, innerXml);
  const url = `${cfg.host.replace(/\/$/, "")}/${resource}`;
  if (process.env.WEBISCO_DEBUG === "true") {
    console.log(`[webisco] → POST ${url}\n${body}`);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Webisco HTTP ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  if (process.env.WEBISCO_DEBUG === "true") {
    console.log(`[webisco] ← ${res.status}\n${text.slice(0, 2000)}`);
  }
  return text;
}

function parseEnvelope(xml: string): { content: Record<string, unknown>; error: string | null } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: true,
    trimValues: true,
    // The Webisco response sometimes returns a single item where we'd
    // expect a list — normalize lists later.
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const envelope = doc["webisco"] as Record<string, unknown> | undefined;
  if (!envelope) throw new Error("Invalid Webisco response (no <webisco> element)");
  const error = (envelope.errormessage as string) || null;
  const content = (envelope.content as Record<string, unknown>) ?? {};
  return { content, error: error && error.length > 0 ? error : null };
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return String(v);
}

// ────────────────────────────────────────────────────────────────────────
// High-level operations
// ────────────────────────────────────────────────────────────────────────

/**
 * Strip letter prefixes from an order number. Webisco expects the numeric
 * part only — e.g. "A243775523" → "243775523", "R123456" → "123456".
 * If the input is already digits-only, return it unchanged.
 */
function normalizeBelegNumber(s: string): string {
  const trimmed = s.trim();
  // Capture leading letters + digits; return just the digits part
  const m = trimmed.match(/^[A-Za-z]*(\d+)$/);
  return m ? m[1] : trimmed;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Decides whether the user-entered number is the internal Abisco beleg-id
 * (purely numeric, optionally with a single letter prefix like A/R/L) or
 * the customer-facing external order number (anything else — typically
 * contains a hyphen, like "KB24-73627372300").
 */
function classifyInput(s: string): { kind: "id" | "bestellnummer"; value: string } {
  const trimmed = s.trim();
  // "A243775523", "R123456", "243775523" → internal id
  if (/^[A-Za-z]?\d+$/.test(trimmed)) {
    return { kind: "id", value: trimmed.replace(/^[A-Za-z]+/, "") };
  }
  // Anything else (contains "-", letters mid-string, etc.) → external bestellnummer
  return { kind: "bestellnummer", value: trimmed };
}

/**
 * Fetches a single order (beleg) by order number, including its positions.
 * Accepts either the internal Abisco id (A243775523) or the external
 * customer-facing order number (KB24-73627372300). typ defaults to
 * 'auftrag' because bestellnummer lookups only work with typ=auftrag.
 */
export async function fetchBelegByNumber(
  cfg: WebiscoConfig,
  options: {
    typ?: "auftrag" | "rechnung" | "lieferschein" | "angebot";
    id: string;
  }
): Promise<WebiscoResult<Beleg[]>> {
  const input = classifyInput(options.id);
  // bestellnummer lookups require typ=auftrag; fall back for id lookups
  // to the user's choice or 'auftrag' as the most useful default.
  const typ = input.kind === "bestellnummer" ? "auftrag" : options.typ ?? "auftrag";

  // Webisco requires von/bis for non-id searches and caps the range at
  // 365 days. We send a ~360-day window which is effectively "all recent
  // belege" for a retouren portal (returns are almost always well within
  // a year of the order).
  const bis = new Date();
  const von = new Date();
  von.setDate(von.getDate() - 360);

  const attrs = [`typ="${typ}"`];
  if (input.kind === "id") {
    attrs.push(`id="${xmlEscape(input.value)}"`);
  } else {
    attrs.push(`bestellnummer="${xmlEscape(input.value)}"`);
  }
  attrs.push(`von="${formatDate(von)}"`);
  attrs.push(`bis="${formatDate(bis)}"`);
  attrs.push(`positionen="T"`);

  const inner = `<beleganfrage ${attrs.join(" ")}/>`;

  let xml: string;
  try {
    xml = await callWebisco(cfg, "beleganfrage", inner);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  let env;
  try {
    env = parseEnvelope(xml);
  } catch (e) {
    return { ok: false, error: `Parse error: ${e instanceof Error ? e.message : e}` };
  }

  if (env.error) return { ok: false, error: env.error };

  const belegliste = env.content["belegliste"] as Record<string, unknown> | undefined;
  if (!belegliste) return { ok: true, data: [] };

  const belege = toArray(belegliste["beleg"] as unknown);

  const parseAdresse = (a: unknown): Adresse | undefined => {
    if (!a || typeof a !== "object") return undefined;
    const addr = a as Record<string, unknown>;
    return {
      anrede: str(addr.anrede),
      vorname: str(addr.vorname),
      name: str(addr.name),
      strasse: str(addr.strasse),
      plz: str(addr.plz),
      ort: str(addr.ort),
      land: str(addr.land),
      email: str(addr.email),
      telefon: str(addr.telefon),
      handy: str(addr.handy),
    };
  };

  const result: Beleg[] = belege.map((b) => {
    const beleg = b as Record<string, unknown>;
    const positions = toArray(beleg["position"] as unknown);
    return {
      typ: str(beleg.typ) ?? typ,
      id: Number(beleg.id) || 0,
      belegnummer: str(beleg.belegnummer),
      belegdatum: str(beleg.belegdatum),
      status: str(beleg.status),
      bestellnummer: str(beleg.bestellnummer),
      bestellername: str(beleg.bestellername),
      kundennummer: num(beleg.kundennummer),
      endpreis_netto: num(beleg.endpreis_netto),
      endpreis_brutto: num(beleg.endpreis_brutto),
      erstellt: str(beleg.erstellt),
      mitarbeiter: str(beleg.mitarbeiter),
      rechnungsadresse: parseAdresse(beleg.rechnungsadresse),
      lieferadresse: parseAdresse(beleg.lieferadresse),
      positionen: positions.map((p) => {
        const pos = p as Record<string, unknown>;
        return {
          id: Number(pos.id) || 0,
          typ: str(pos.typ) ?? "artikel",
          artikelnummer: str(pos.artikelnummer),
          hersteller: str(pos.hersteller),
          herstellernummer: str(pos.herstellernummer),
          beschreibung: str(pos.beschreibung),
          menge: num(pos.menge),
          einzelpreis_netto: num(pos.einzelpreis_netto),
          einzelpreis_brutto: num(pos.einzelpreis_brutto),
          positionspreis_netto: num(pos.positionspreis_netto),
          positionspreis_brutto: num(pos.positionspreis_brutto),
          status: str(pos.status),
          bestelldatum: str(pos.bestelldatum),
          lieferdatum: str(pos.lieferdatum),
          rechnungsdatum: str(pos.rechnungsdatum),
          offene_gutschriftsmenge: num(pos.offene_gutschriftsmenge),
          einzelgewicht: num(pos.einzelgewicht),
        };
      }),
    };
  });

  return { ok: true, data: result };
}

/**
 * Append a free-text Bemerkung to an existing Beleg in Abisco.
 * Appears in Abisco's document with timestamp + author (webisco user).
 */
export async function addBelegBemerkung(
  cfg: WebiscoConfig,
  options: {
    typ?: "auftrag" | "rechnung" | "lieferschein" | "angebot";
    id: string | number;
    text: string;
  }
): Promise<WebiscoResult<{ ok: true }>> {
  const typ = options.typ ?? "auftrag";
  const id = String(options.id).replace(/^[A-Za-z]+/, "");
  const inner = `<belegbemerkung typ="${typ}" id="${xmlEscape(id)}" text="${xmlEscape(options.text)}"/>`;

  let xml: string;
  try {
    xml = await callWebisco(cfg, "belegbemerkung", inner);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  try {
    const env = parseEnvelope(xml);
    if (env.error) return { ok: false, error: env.error };
  } catch (e) {
    return { ok: false, error: `Parse error: ${e instanceof Error ? e.message : e}` };
  }

  return { ok: true, data: { ok: true } };
}

export function getWebiscoConfig(): WebiscoConfig | null {
  const host = process.env.WEBISCO_HOST;
  const username = process.env.WEBISCO_USERNAME;
  const password = process.env.WEBISCO_PASSWORD;
  const adminid = process.env.WEBISCO_ADMIN_ID;
  if (!host || !username) return null;
  // Need either a password or an admin-id to authenticate
  if (!password && !adminid) return null;
  return { host, username, password, adminid };
}

// ────────────────────────────────────────────────────────────────────────
// Demo / mock mode (when Webisco isn't reachable yet)
// ────────────────────────────────────────────────────────────────────────
export function mockBelegByNumber(bestellnummer: string): Beleg[] {
  if (bestellnummer === "demo" || bestellnummer === "12345" || bestellnummer === "R123456") {
    return [
      {
        typ: "rechnung",
        id: 123456,
        belegnummer: "R123456",
        belegdatum: "2026-03-15",
        status: "verrechnet",
        bestellnummer: bestellnummer,
        bestellername: "Demo Kunde",
        kundennummer: 10042,
        endpreis_netto: 284.55,
        endpreis_brutto: 338.61,
        erstellt: "2026-03-15 10:23:41",
        positionen: [
          {
            id: 9001,
            typ: "artikel",
            artikelnummer: "BMW-51478402591",
            hersteller: "BMW",
            herstellernummer: "51478402591",
            beschreibung: "Fußmatten-Satz Velours schwarz",
            menge: 1,
            einzelpreis_netto: 129.5,
            einzelpreis_brutto: 154.1,
            positionspreis_netto: 129.5,
            positionspreis_brutto: 154.1,
            status: "geliefert",
            lieferdatum: "2026-03-16",
            offene_gutschriftsmenge: 1,
            einzelgewicht: 2400,
          },
          {
            id: 9002,
            typ: "artikel",
            artikelnummer: "MANN-C30195",
            hersteller: "MANN-FILTER",
            herstellernummer: "C 30 195",
            beschreibung: "Luftfilter",
            menge: 2,
            einzelpreis_netto: 32.5,
            einzelpreis_brutto: 38.68,
            positionspreis_netto: 65.0,
            positionspreis_brutto: 77.35,
            status: "geliefert",
            lieferdatum: "2026-03-16",
            offene_gutschriftsmenge: 2,
            einzelgewicht: 450,
          },
          {
            id: 9003,
            typ: "artikel",
            artikelnummer: "OSRAM-64150",
            hersteller: "Osram",
            herstellernummer: "64150",
            beschreibung: "Halogenlampe H1 12V 55W",
            menge: 4,
            einzelpreis_netto: 4.75,
            einzelpreis_brutto: 5.65,
            positionspreis_netto: 19.0,
            positionspreis_brutto: 22.61,
            status: "geliefert",
            lieferdatum: "2026-03-16",
            offene_gutschriftsmenge: 4,
            einzelgewicht: 35,
          },
        ],
      },
    ];
  }
  return [];
}
