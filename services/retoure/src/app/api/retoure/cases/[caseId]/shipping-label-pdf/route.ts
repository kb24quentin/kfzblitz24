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
import { fetchShipmentLabelPdf } from "@/lib/dodajpaczke";

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

  // Label via Helper holen (nutzt Login+Password→Token Auth-Flow)
  const result = await fetchShipmentLabelPdf(c.dhlShipmentId);
  if (!result.ok && result.skipped === true) {
    return NextResponse.json(
      { error: "dodajpaczke_not_configured", note: result.reason },
      { status: 503 },
    );
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: "label_fetch_failed", message: result.error },
      { status: 502 },
    );
  }

  return new Response(new Uint8Array(result.pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(result.pdfBuffer.length),
      "Content-Disposition": `inline; filename="versandlabel-${c.bestellnummer}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
