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
  typ?: "auftrag" | "rechnung" | "lieferschein" | "angebot";
};

export async function POST(req: Request) {
  let payload: LookupRequest;
  try {
    payload = (await req.json()) as LookupRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const bestellnummer = (payload.bestellnummer || "").trim();
  if (!bestellnummer) {
    return NextResponse.json(
      { ok: false, error: "Bestellnummer fehlt" },
      { status: 400 }
    );
  }

  const cfg = getWebiscoConfig();
  const demoMode = !cfg || process.env.WEBISCO_DEMO_MODE === "true";

  if (demoMode) {
    const belege = mockBelegByNumber(bestellnummer);
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

  const belege: Beleg[] = result.data;
  return NextResponse.json({ ok: true, mode: "live", belege });
}
