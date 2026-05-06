/**
 * TEMP / TEST FEATURE — Rechnungs-Viewer.
 *
 * Stellt das PDF der zur Bestellung gehörenden Rechnung bereit. Wird im
 * Retouren-Portal Schritt 2 als "Rechnung ansehen" Button benutzt.
 *
 * Komplett-entfernen = dieses File löschen + den TEMP-Block in
 * src/app/page.tsx entfernen. Sonst nichts.
 */

import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { getWebiscoConfig } from "@/lib/webisco";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildEnvelope(
  cfg: NonNullable<ReturnType<typeof getWebiscoConfig>>,
  inner: string
): string {
  const v = cfg.version ?? 21;
  const attrs = [
    `version="${v}"`,
    `username="${xmlEscape(cfg.username)}"`,
    cfg.adminid ? `adminid="${xmlEscape(cfg.adminid)}"` : "",
    `password="${xmlEscape(cfg.password ?? "")}"`,
    `type="request"`,
  ]
    .filter(Boolean)
    .join(" ");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<webisco ${attrs}>\n<content>${inner}</content>\n</webisco>`;
}

async function call(
  cfg: NonNullable<ReturnType<typeof getWebiscoConfig>>,
  resource: string,
  inner: string
): Promise<string> {
  const url = `${cfg.host.replace(/\/$/, "")}/${resource}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: buildEnvelope(cfg, inner),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Webisco HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizePlz(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, "").trim();
}

function arrayify<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: true,
  trimValues: true,
});

type WebiscoDoc = {
  webisco?: {
    errormessage?: string;
    content?: {
      belegliste?: {
        beleg?: unknown;
      };
    };
  };
};

export async function POST(req: Request) {
  let payload: { belegId?: number | string; plz?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const belegIdStr = String(payload.belegId ?? "").replace(/^[A-Za-z]+/, "").trim();
  const plz = normalizePlz(payload.plz);
  if (!belegIdStr || !/^\d+$/.test(belegIdStr)) {
    return NextResponse.json({ error: "Beleg-ID erforderlich" }, { status: 400 });
  }
  if (!plz) {
    return NextResponse.json({ error: "PLZ erforderlich" }, { status: 400 });
  }

  const cfg = getWebiscoConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Demo-Modus aktiv — keine echte Rechnung verfügbar." },
      { status: 503 }
    );
  }

  const bis = new Date();
  const von = new Date();
  von.setDate(von.getDate() - 360);

  // Step 1: Auftrag holen mit belegverlauf=T
  let auftragXml: string;
  try {
    auftragXml = await call(
      cfg,
      "beleganfrage",
      `<beleganfrage typ="auftrag" id="${xmlEscape(belegIdStr)}" von="${ymd(von)}" bis="${ymd(bis)}" belegverlauf="T"/>`
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Webisco: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  const auftragDoc = parser.parse(auftragXml) as WebiscoDoc;
  const errMsg = auftragDoc?.webisco?.errormessage;
  if (errMsg && String(errMsg).length > 0) {
    return NextResponse.json({ error: String(errMsg) }, { status: 502 });
  }

  const belege = arrayify(auftragDoc?.webisco?.content?.belegliste?.beleg);
  if (belege.length === 0) {
    return NextResponse.json({ error: "Bestellung nicht gefunden" }, { status: 404 });
  }

  // PLZ verifizieren
  const matching = belege.find((b) => {
    const beleg = b as Record<string, unknown>;
    const ra = (beleg.rechnungsadresse as Record<string, unknown> | undefined)?.plz;
    const la = (beleg.lieferadresse as Record<string, unknown> | undefined)?.plz;
    return [ra, la]
      .filter(Boolean)
      .map((x) => normalizePlz(String(x)))
      .includes(plz);
  });

  if (!matching) {
    return NextResponse.json(
      { error: "PLZ stimmt nicht mit der Rechnungsadresse überein." },
      { status: 403 }
    );
  }

  // Step 2: Rechnung aus Belegverlauf finden
  const matchingObj = matching as Record<string, unknown>;
  const verlauf = arrayify(matchingObj.belegverlauf as unknown);
  const rechnungEntry = verlauf.find((v) => {
    const item = v as Record<string, unknown>;
    return String(item.typ) === "rechnung";
  });

  if (!rechnungEntry) {
    return NextResponse.json(
      { error: "Zu dieser Bestellung wurde noch keine Rechnung erstellt." },
      { status: 404 }
    );
  }

  const rechnungEntryObj = rechnungEntry as Record<string, unknown>;
  const rechnungId = String(rechnungEntryObj.id ?? "");
  if (!rechnungId || !/^\d+$/.test(rechnungId)) {
    return NextResponse.json({ error: "Rechnungs-ID nicht lesbar" }, { status: 502 });
  }

  // Step 3: Rechnung mit pdf="T" holen
  let rechnungXml: string;
  try {
    rechnungXml = await call(
      cfg,
      "beleganfrage",
      `<beleganfrage typ="rechnung" id="${xmlEscape(rechnungId)}" von="${ymd(von)}" bis="${ymd(bis)}" pdf="T"/>`
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Webisco: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  const rechnungDoc = parser.parse(rechnungXml) as WebiscoDoc;
  const rechnungErr = rechnungDoc?.webisco?.errormessage;
  if (rechnungErr && String(rechnungErr).length > 0) {
    return NextResponse.json({ error: String(rechnungErr) }, { status: 502 });
  }

  const rechnungBelege = arrayify(rechnungDoc?.webisco?.content?.belegliste?.beleg);
  const rechnungBeleg = rechnungBelege[0] as Record<string, unknown> | undefined;
  // PDF kann je nach XML-Form als Attribut ODER als Child-Element auftauchen —
  // fast-xml-parser legt beides als Property auf das Beleg-Objekt.
  const pdfBase64 = rechnungBeleg?.pdf;
  if (!pdfBase64 || typeof pdfBase64 !== "string") {
    return NextResponse.json(
      { error: "Rechnung gefunden, aber kein PDF-Inhalt enthalten." },
      { status: 502 }
    );
  }

  const pdfBuffer = Buffer.from(pdfBase64.replace(/\s+/g, ""), "base64");
  if (pdfBuffer.length < 100) {
    return NextResponse.json(
      { error: "PDF ist leer oder beschädigt." },
      { status: 502 }
    );
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="rechnung-${rechnungId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
