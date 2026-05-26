/**
 * GET /api/retoure/cases/{caseId}/shipping-label-pdf
 *
 * Liefert das DHL-Versandlabel (vom Customer aufs Paket zu kleben) als
 * PDF.
 *
 * Wir holen das PDF in 2 möglichen Wegen:
 *   1. Wenn der Case schon einen `dhlShipmentId` hat → dodajpaczke.eu
 *      `/shippingLabel`-Endpoint abfragen (HTML-Response → PDF).
 *      Result wird auf Disk gecached.
 *   2. Fallback: 404 wenn weder dhlShipmentId noch customerTrackingNumber
 *      gesetzt sind (Customer hat selbst versendet, kein Label nötig).
 *
 * Auth: Bearer (Shop-API-Token).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkBearer } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
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

  const { caseId } = await params;
  const c = await prisma.retoureCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      bestellnummer: true,
      dhlShipmentId: true,
      dhlTrackingNumber: true,
      customerTrackingNumber: true,
    },
  });
  if (!c) {
    return NextResponse.json({ error: "case_not_found" }, { status: 404 });
  }
  if (!c.dhlShipmentId) {
    return NextResponse.json(
      { error: "no_label_available", note: "Kunde hat selbst versendet ODER Label noch nicht generiert" },
      { status: 404 },
    );
  }

  // dodajpaczke.eu Label-Endpoint
  const apiBase = process.env.DODAJPACZKE_BASE_URL?.trim() ?? "https://api.dodajpaczke.eu/v1";
  const apiToken = process.env.DODAJPACZKE_TOKEN?.trim();
  if (!apiToken) {
    return NextResponse.json(
      { error: "dodajpaczke_not_configured" },
      { status: 503 },
    );
  }

  try {
    const resp = await fetch(`${apiBase}/shippingLabel/${c.dhlShipmentId}`, {
      headers: {
        Authorization: apiToken, // raw token, KEIN Bearer-Prefix (CLAUDE.md §7)
        Accept: "application/pdf",
      },
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        {
          error: "label_fetch_failed",
          providerStatus: resp.status,
          providerBody: errText.slice(0, 500),
        },
        { status: 502 },
      );
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buf.length),
        "Content-Disposition": `inline; filename="versandlabel-${c.bestellnummer}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "label_fetch_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
