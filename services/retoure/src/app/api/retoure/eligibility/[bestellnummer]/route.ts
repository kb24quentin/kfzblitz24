/**
 * GET /api/retoure/eligibility/{bestellnummer}
 *
 * Vorab-Check für Shop-UI: kann der Customer für diese Bestellnummer
 * eine neue Retoure anmelden?
 *
 * Auth: Bearer (Shop-API-Token).
 *
 * Response:
 *   {
 *     eligible: boolean,
 *     reason: null | "order_not_found" | "frist_abgelaufen" | "already_open_case" | ...,
 *     eligibleUntil: ISO-Date | null,
 *     existingCases: [...]
 *   }
 */
import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { checkEligibility } from "@/lib/eligibility";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bestellnummer: string }> },
) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status },
    );
  }

  const { bestellnummer } = await params;
  const url = new URL(req.url);
  const deliveredAtStr = url.searchParams.get("deliveredAt");
  const kundenstatus = url.searchParams.get("kundenstatus") as
    | "privat"
    | "gewerbe_vorsteuer"
    | null;

  const result = await checkEligibility(bestellnummer, {
    deliveredAt: deliveredAtStr ? new Date(deliveredAtStr) : null,
    kundenstatus: kundenstatus ?? "privat",
  });

  return NextResponse.json({
    eligible: result.eligible,
    reason: result.reason,
    eligibleUntil: result.eligibleUntil?.toISOString() ?? null,
    existingCases: result.existingCases.map((c) => ({
      id: c.id,
      bestellnummer: c.bestellnummer,
      status: c.status,
      kategorie: c.kategorie,
      source: c.source,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      voraussichtlicheErstattung: c.voraussichtlicheErstattung,
    })),
  });
}
