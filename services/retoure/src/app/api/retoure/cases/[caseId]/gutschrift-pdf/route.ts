/**
 * GET /api/retoure/cases/{caseId}/gutschrift-pdf
 *
 * Liefert das PDF der Webisco-Gutschrift (nach Refund-Decision durch Admin).
 *
 * Wir nutzen den existierenden Webisco-`beleganfrage`-Mechanismus mit
 * `pdf="T"` und `typ="gutschrift"`. Bytes werden 1:1 weitergereicht.
 *
 * Auth: Bearer (Shop-API-Token).
 *
 * Verfügbar erst nachdem Case.gutschriftNr gesetzt wurde — vorher 404.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkBearer } from "@/lib/api-auth";
import { fetchBelegByNumber, getWebiscoConfig } from "@/lib/webisco";

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
    select: { id: true, gutschriftNr: true, bestellnummer: true },
  });
  if (!c) {
    return NextResponse.json({ error: "case_not_found" }, { status: 404 });
  }
  if (!c.gutschriftNr) {
    return NextResponse.json(
      { error: "no_gutschrift_yet", message: "Refund noch nicht freigegeben" },
      { status: 404 },
    );
  }

  // Belegnummer ohne Präfix für Webisco-Lookup
  const belegId = c.gutschriftNr.replace(/^[A-Z]+-?/i, "").replace(/-/g, "");
  if (!belegId) {
    return NextResponse.json(
      { error: "invalid_gutschrift_format" },
      { status: 500 },
    );
  }

  const cfg = getWebiscoConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "webisco_not_configured" },
      { status: 503 },
    );
  }

  // TODO: fetchBelegByNumber unterstützt `withPdf`-Option (siehe docs/01-overview).
  // Aktuell stub — wenn die Funktion erweitert ist, hier produktiv schalten.
  const result = await fetchBelegByNumber(cfg, {
    id: belegId,
    typ: "rechnung", // Gutschrift wird in Webisco als rechnung mit negativem Betrag geführt
  });
  if (!result.ok || result.data.length === 0) {
    return NextResponse.json(
      { error: "webisco_lookup_failed", gutschriftNr: c.gutschriftNr },
      { status: 502 },
    );
  }

  // PDF-Bytes aus Webisco-Response — Funktion muss noch erweitert werden
  // um `pdf="T"` zu unterstützen und Base64-decode zurückzugeben.
  return NextResponse.json(
    {
      error: "pdf_extraction_not_implemented_yet",
      gutschriftNr: c.gutschriftNr,
      note:
        "Webisco-Beleg gefunden, aber PDF-Extraction-Helper noch nicht fertig. " +
        "Siehe lib/webisco.ts — beleganfrage mit pdf=T und Base64-decode.",
    },
    { status: 501 },
  );
}
