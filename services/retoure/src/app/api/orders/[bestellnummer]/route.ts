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

  // Try candidates in order — first hit wins. Customers/agents type shortened
  // or ambiguous refs; Webisco's field where the order lives varies:
  //   - "KB24-…", "W…" etc → bestellnummer (external)
  //   - "AW…"              → auftragsnummer (Abisco internal)
  //   - "W…" (no A prefix) sometimes displays without the A but is stored as
  //     "AW…" in Webisco → try "A"+input as auftragsnummer fallback.
  const candidates = new Set<string>();
  candidates.add(bestellnummer);
  if (/^W\d+$/i.test(bestellnummer)) candidates.add(`A${bestellnummer}`);
  if (/^\d+$/.test(bestellnummer)) candidates.add(`AW${bestellnummer}`);

  let belege: Beleg[] = [];
  let lastError: string | null = null;

  for (const candidate of candidates) {
    if (demoMode) {
      belege = mockBelegByNumber(candidate);
    } else {
      const result = await fetchBelegByNumber(cfg, { typ: "auftrag", id: candidate });
      if (!result.ok) {
        lastError = result.error;
        continue;
      }
      belege = result.data;
    }
    if (belege.length > 0) break;
  }

  if (belege.length === 0) {
    if (lastError) {
      return NextResponse.json(
        { ok: false, mode: "live", error: lastError },
        { status: 502 },
      );
    }
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
