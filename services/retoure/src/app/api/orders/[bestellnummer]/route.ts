import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import {
  fetchBelegByNumber,
  getWebiscoConfig,
  mockBelegByNumber,
  type Beleg,
} from "@/lib/webisco";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Internal order lookup for the Support service. Unlike /api/lookup (public,
 * PLZ-gated for the retoure portal), this endpoint requires an internal
 * Bearer token — the calling service is responsible for its own
 * datenschutz-guard (e.g. cross-checking the ticket email vs. the beleg
 * email). Returns the raw beleg so the caller can decide what to expose.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ bestellnummer: string }> },
) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: auth.status });
  }

  const { bestellnummer: rawParam } = await params;
  const bestellnummer = decodeURIComponent(rawParam || "").trim();
  if (!bestellnummer) {
    return NextResponse.json({ ok: false, error: "bestellnummer_missing" }, { status: 400 });
  }

  const cfg = getWebiscoConfig();
  const demoMode = !cfg || process.env.WEBISCO_DEMO_MODE === "true";

  // KB24-interne Nummern-Semantik (Auskunft User 2026-07-15):
  //   A…     → Auftrag (Belegnummer eines Auftrags-Belegs)
  //   AW…    → Rechnung (Belegnummer eines Rechnungs-Belegs)
  //   W…     → Bestellnummer (kundenzugewandte Referenz — was der Kunde sieht)
  //   KB24-… → Bestellnummer (Shopware/Marketplace-Format)
  //
  // A/AW/W sind SEMANTISCH VERSCHIEDEN — keine variationen desselben.
  // Deshalb NIEMALS versuchen A/AW als fallback für W-input zu tippen,
  // das würde fremde belege matchen die zufällig dieselben ziffern haben.
  // Wenn W-Bestellnummer nicht als bestellnummer findbar ist, ist der
  // Beleg aktuell nicht in Webisco (marketplace-sync-lücke etc.) —
  // ehrlich 'not_found' zurückgeben, nicht raten.
  let belege: Beleg[];
  if (demoMode) {
    belege = mockBelegByNumber(bestellnummer);
  } else {
    const result = await fetchBelegByNumber(cfg, { typ: "auftrag", id: bestellnummer });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, mode: "live", error: result.error },
        { status: 502 },
      );
    }
    belege = result.data;
  }

  if (belege.length === 0) {
    return NextResponse.json({ ok: false, error: "not_found", mode: demoMode ? "demo" : "live" }, { status: 404 });
  }

  // Return the newest beleg only — for a single Bestellnummer there should
  // normally be exactly one Auftrag; if Webisco surfaces multiple, prefer
  // the most recent by belegdatum.
  const beleg = belege.slice().sort((a, b) => {
    const da = a.belegdatum || "";
    const db = b.belegdatum || "";
    return db.localeCompare(da);
  })[0];

  return NextResponse.json({ ok: true, mode: demoMode ? "demo" : "live", beleg });
}
