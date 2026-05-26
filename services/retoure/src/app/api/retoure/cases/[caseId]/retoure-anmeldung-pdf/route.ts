/**
 * GET /api/retoure/cases/{caseId}/retoure-anmeldung-pdf
 *
 * Komplettes Customer-Retoure-PDF (Retourenschein + optional DHL-Label
 * embedded auf Seite 2). Layout identisch zum Customer-Portal-PDF.
 *
 * Der Shop ruft das nach erfolgreichem `/submit` ab und gibt das PDF
 * dem Customer auf der Bestätigungs-Seite + per Mail.
 *
 * Auth: Bearer (Shop-API-Token).
 *
 * Wenn der Case ein DHL-Label hat (`dhlShipmentId`), holen wir das PDF
 * von dodajpaczke + embedden es als Seite 2. Wenn keins, kommt nur
 * Seite 1.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkBearer } from "@/lib/api-auth";
import { buildRetoureAnmeldungPdf } from "@/lib/retoure-anmeldung-pdf";

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
    include: {
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) {
    return NextResponse.json({ error: "case_not_found" }, { status: 404 });
  }

  // Optional: DHL-Label-PDF von dodajpaczke holen (best-effort, blockiert nicht)
  let labelPdfBytes: Uint8Array | null = null;
  if (c.dhlShipmentId) {
    try {
      const apiBase =
        process.env.DODAJPACZKE_BASE_URL?.trim() ?? "https://api.dodajpaczke.eu/v1";
      const apiToken = process.env.DODAJPACZKE_TOKEN?.trim();
      if (apiToken) {
        let resp = await fetch(
          `${apiBase}/shipments/${c.dhlShipmentId}/shippingLabel`,
          { headers: { Authorization: apiToken } },
        );
        if (resp.status === 404) {
          resp = await fetch(
            `${apiBase}/shipments/${c.dhlShipmentId}/retoureLabel`,
            { headers: { Authorization: apiToken } },
          );
        }
        if (resp.ok) {
          const json = (await resp.json()) as { data?: { file?: string } };
          if (json.data?.file) {
            labelPdfBytes = Buffer.from(
              json.data.file.replace(/\s+/g, ""),
              "base64",
            );
          }
        }
      }
    } catch (err) {
      console.warn(
        `[retoure-anmeldung-pdf] label fetch failed for case ${caseId}:`,
        err,
      );
      // Defensive — wir liefern trotzdem das PDF ohne Label-Seite
    }
  }

  // Items mapping: aus DB-Items + Webisco-enrichted Felder
  const items = c.items.map((it) => ({
    artikelnummer: it.artikelnummer,
    hersteller: it.hersteller,
    beschreibung: it.beschreibung,
    menge: it.menge,
    grund: it.grundFreitext ?? it.grund ?? "—",
    einzelpreis_brutto: it.einzelpreis_brutto,
    gesamtpreis_brutto: it.gesamtpreis_brutto,
  }));

  const pdfBytes = await buildRetoureAnmeldungPdf({
    bestellnummer: c.bestellnummer,
    belegnummer: c.belegnummer,
    belegdatum: c.belegdatum,
    rechnungsadresse: {
      anrede: c.customerAnrede,
      vorname: c.customerVorname,
      name: c.customerName,
      strasse: c.customerStrasse,
      plz: c.customerPlz,
      ort: c.customerOrt,
      email: c.customerEmail,
      telefon: c.customerTelefon,
    },
    items,
    shippingMode: (c.shippingMode === "sicher" ? "sicher" : "standard"),
    labelPdfBytes,
    labelTrackingNumber: c.dhlTrackingNumber,
    labelFeeBrutto: c.labelFeeBrutto,
    // Label-Net = Brutto / 1.19, gerundet — nur für Anzeige
    labelFeeNet: c.labelFeeBrutto > 0 ? Math.round((c.labelFeeBrutto / 1.19) * 100) / 100 : 0,
  });

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdfBytes.length),
      "Content-Disposition": `inline; filename="retourenschein-${c.bestellnummer}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
