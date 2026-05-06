import { NextResponse } from "next/server";
import {
  fetchBelegByNumber,
  getWebiscoConfig,
  mockBelegByNumber,
  type Beleg,
} from "@/lib/webisco";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LookupRequest = {
  bestellnummer?: string;
  plz?: string;
  // typ is accepted but usually auto-derived server-side
  typ?: "auftrag" | "rechnung" | "lieferschein" | "angebot";
};

function normalizePlz(input: string | undefined | null): string {
  return (input ?? "").replace(/\s+/g, "").trim();
}

/**
 * PLZ check: a beleg matches if the input PLZ equals either the
 * Rechnungs- or Lieferadresse PLZ. We compare the normalized digits-only
 * form so trailing whitespace or formatting don't trip up legit customers.
 */
function belegMatchesPlz(beleg: Beleg, plz: string): boolean {
  const target = normalizePlz(plz);
  if (!target) return false;
  const candidates = [
    beleg.rechnungsadresse?.plz,
    beleg.lieferadresse?.plz,
  ]
    .map(normalizePlz)
    .filter(Boolean);
  return candidates.includes(target);
}

export async function POST(req: Request) {
  let payload: LookupRequest;
  try {
    payload = (await req.json()) as LookupRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const bestellnummer = (payload.bestellnummer || "").trim();
  const plz = normalizePlz(payload.plz);

  if (!bestellnummer) {
    return NextResponse.json(
      { ok: false, error: "Bestellnummer fehlt" },
      { status: 400 }
    );
  }
  if (!plz) {
    return NextResponse.json(
      { ok: false, error: "Postleitzahl fehlt" },
      { status: 400 }
    );
  }

  const cfg = getWebiscoConfig();
  const demoMode = !cfg || process.env.WEBISCO_DEMO_MODE === "true";

  if (demoMode) {
    const allBelege = mockBelegByNumber(bestellnummer);
    const belege = allBelege.filter((b) => belegMatchesPlz(b, plz));
    return NextResponse.json({
      ok: true,
      mode: "demo",
      belege,
      hint: cfg
        ? "WEBISCO_DEMO_MODE=true — Mock-Daten aktiv"
        : "WEBISCO_HOST/USERNAME/PASSWORD nicht gesetzt — Mock-Daten aktiv",
    });
  }

  const result = await fetchBelegByNumber(cfg, {
    typ: payload.typ ?? "rechnung",
    id: bestellnummer,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, mode: "live", error: result.error },
      { status: 502 }
    );
  }

  // Filter strictly: customer must know both Bestellnummer AND PLZ.
  // We deliberately return an empty list (instead of an explicit "PLZ
  // stimmt nicht") so we don't leak that an order with this number exists.
  const belege: Beleg[] = result.data.filter((b) => belegMatchesPlz(b, plz));
  return NextResponse.json({ ok: true, mode: "live", belege });
}
