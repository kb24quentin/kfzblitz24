/**
 * POST /api/pda/cases/:id/scan-ean
 *
 * Worker scannt einen Artikel-Barcode (EAN). Backend klassifiziert und
 * reagiert in drei Phasen — siehe `lib/scan-ean.ts` für die ausgelagerte
 * Match/Apply-Kette.
 *
 *   1. EAN matched ein registriertes Item (status="pending")
 *      → status="received" → kind="ok_registered"
 *   2. EAN matched Webisco-Artikel auf der Order
 *      → fügt als source="extra" hinzu → kind="ok_extra"
 *   3. EAN unbekannt oder nicht auf Order
 *      → fügt als source="unknown" auf kfzBlitz24-internal-Palette →
 *        kind="not_ok_unknown"
 *
 * Body: { ean: string, pdaId?: string }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { scanEanForCase } from "@/lib/scan-ean";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ScanEanBody {
  ean?: string;
  pdaId?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status },
    );
  }

  const { id } = await params;
  let body: ScanEanBody;
  try {
    body = (await req.json()) as ScanEanBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ean = (body.ean ?? "").trim();
  if (ean.length === 0) {
    return NextResponse.json({ error: "ean fehlt" }, { status: 400 });
  }

  const actor = body.pdaId ? `pda:${body.pdaId}` : "pda";

  const exists = await prisma.retoureCase.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const result = await scanEanForCase(id, ean, actor);
  return NextResponse.json(result);
}
