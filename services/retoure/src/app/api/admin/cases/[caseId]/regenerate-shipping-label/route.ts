/**
 * POST /api/admin/cases/{caseId}/regenerate-shipping-label
 *
 * Erzeugt nachträglich ein DHL-Retoure-Label für einen bereits existierenden
 * Case und schreibt shipmentId + trackingNumber in die DB.
 *
 * Use-Case: Beim ursprünglichen Submit ist createRetoureLabel gescheitert
 * (dodajpaczke-Token expired, dodajpaczke-Downtime, Rate-Limit …). Der Case
 * ist trotzdem angelegt, aber `dhlShipmentId` ist NULL — dadurch gibt der
 * shipping-label-pdf-Endpoint 404. Dieser Endpoint holt das Label nach.
 *
 * Idempotenz: wenn `dhlShipmentId` bereits gesetzt ist, wird KEIN neuer
 * Shipment erzeugt (das würde beim Provider doppelte Kosten auslösen).
 * Der Endpoint gibt dann 200 mit dem bestehenden Label zurück. Wer wirklich
 * neu will, muss ?force=1 setzen — dann wird ein neuer Shipment angelegt,
 * die alte ID landet in `dhlShipmentIdPrevious` im Event-Log.
 *
 * Auth: NextAuth-Session (Admin-UI) ODER Bearer (Shop-API).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkBearer } from "@/lib/api-auth";
import { createRetoureLabel } from "@/lib/dodajpaczke";
import { addEvent } from "@/lib/retoure-cases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function isAuthorized(req: Request): Promise<boolean> {
  if (req.headers.get("authorization")) {
    const r = checkBearer(req);
    if (r.ok) return true;
  }
  const session = await auth();
  return !!session?.user?.email;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ caseId: string }> },
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { caseId } = await ctx.params;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const c = await prisma.retoureCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      bestellnummer: true,
      dhlShipmentId: true,
      dhlTrackingNumber: true,
      customerAnrede: true,
      customerVorname: true,
      customerName: true,
      customerStrasse: true,
      customerPlz: true,
      customerOrt: true,
      customerEmail: true,
      customerTelefon: true,
      customerHandy: true,
      weightSentKg: true,
      itemsJson: true,
    },
  });
  if (!c) {
    return NextResponse.json({ error: "case_not_found" }, { status: 404 });
  }

  if (c.dhlShipmentId && !force) {
    return NextResponse.json({
      ok: true,
      alreadyExists: true,
      shipmentId: c.dhlShipmentId,
      trackingNumber: c.dhlTrackingNumber,
      note: "Case hat bereits ein Label. Query-Param ?force=1 überschreibt (kostet doppelt beim Provider!).",
    });
  }

  // Gewicht bestimmen — priorisiere weightSentKg (vom PDA gemessen),
  // sonst summieren wir aus itemsJson.einzelgewicht_g * menge und
  // fallen sonst auf 5 kg (submit-Default) zurück.
  let weightInKg = c.weightSentKg ?? 0;
  if (!weightInKg && c.itemsJson) {
    try {
      const items = JSON.parse(c.itemsJson) as Array<{
        einzelgewicht_g?: number | null;
        menge?: number | null;
      }>;
      const sumG = items.reduce((acc, it) => {
        const g = it.einzelgewicht_g ?? 0;
        const m = it.menge ?? 1;
        return acc + g * m;
      }, 0);
      if (sumG > 0) weightInKg = Math.max(0.5, Math.ceil(sumG / 1000));
    } catch { /* fall through */ }
  }
  if (!weightInKg) weightInKg = 5;

  const previousShipmentId = c.dhlShipmentId;

  const labelResult = await createRetoureLabel({
    weightInKg,
    customerReference: c.bestellnummer,
    description: `Retoure ${c.bestellnummer}`,
    customer: {
      salutation: c.customerAnrede ?? undefined,
      firstname: c.customerVorname ?? undefined,
      lastname: c.customerName ?? undefined,
      streetName: c.customerStrasse ?? undefined,
      zipNumber: c.customerPlz ?? undefined,
      city: c.customerOrt ?? undefined,
      countryISOCode: "DE",
      email: c.customerEmail ?? undefined,
      phone: c.customerTelefon ?? undefined,
      mobile: c.customerHandy ?? undefined,
    },
  });

  if (!labelResult.ok) {
    if ("skipped" in labelResult && labelResult.skipped) {
      return NextResponse.json(
        { error: "dodajpaczke_not_configured", note: labelResult.reason },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "label_creation_failed", message: labelResult.error },
      { status: 502 },
    );
  }

  await prisma.retoureCase.update({
    where: { id: caseId },
    data: {
      dhlShipmentId: labelResult.shipmentId,
      dhlTrackingNumber: labelResult.trackingNumber ?? null,
      dhlRetoureIdc: labelResult.retoureIdc ?? null,
      weightSentKg: weightInKg,
    },
  });

  await addEvent(
    caseId,
    force ? "label_regenerated" : "label_recovered",
    force
      ? `Label neu erzeugt (force=1). Neue Tracking: ${labelResult.trackingNumber ?? "?"}`
      : `Label nachträglich erzeugt (war beim Submit fehlgeschlagen). Tracking: ${labelResult.trackingNumber ?? "?"}`,
    {
      shipmentId: labelResult.shipmentId,
      trackingNumber: labelResult.trackingNumber,
      previousShipmentId,
      weightInKg,
    },
    "admin:regenerate",
  );

  const baseUrl = process.env.RETOURE_PUBLIC_URL?.replace(/\/+$/, "") ?? "";
  return NextResponse.json({
    ok: true,
    caseId,
    shipmentId: labelResult.shipmentId,
    trackingNumber: labelResult.trackingNumber,
    weightInKg,
    shippingLabelPdfUrl: `${baseUrl}/api/retoure/cases/${caseId}/shipping-label-pdf`,
  });
}
