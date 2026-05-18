/**
 * GET   /api/retoure/:id           — Case + Timeline
 * PATCH /api/retoure/:id           — Status / Notiz / customerTrackingNumber updaten
 *
 * Bearer-Auth via API_TOKEN.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkBearer } from "@/lib/api-auth";
import { transitionStatus, addEvent } from "@/lib/retoure-cases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized" },
      { status: auth.status }
    );
  }
  const { id } = await params;
  const c = await prisma.retoureCase.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!c) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: c.id,
    bestellnummer: c.bestellnummer,
    belegId: c.belegId,
    belegnummer: c.belegnummer,
    status: c.status,
    customer: {
      anrede: c.customerAnrede,
      vorname: c.customerVorname,
      name: c.customerName,
      strasse: c.customerStrasse,
      plz: c.customerPlz,
      ort: c.customerOrt,
      email: c.customerEmail,
      telefon: c.customerTelefon,
      handy: c.customerHandy,
    },
    shipping: {
      mode: c.shippingMode,
      labelRequested: c.labelRequested,
      labelPaid: c.labelPaid,
      weightSentKg: c.weightSentKg,
    },
    dhl: {
      shipmentId: c.dhlShipmentId,
      trackingNumber: c.dhlTrackingNumber,
      retoureIdc: c.dhlRetoureIdc,
    },
    customerTrackingNumber: c.customerTrackingNumber,
    money: {
      warenwertBrutto: c.warenwertBrutto,
      labelFeeBrutto: c.labelFeeBrutto,
      voraussichtlicheErstattung: c.voraussichtlicheErstattung,
    },
    items: (() => {
      try {
        return JSON.parse(c.itemsJson);
      } catch {
        return [];
      }
    })(),
    adminNotes: c.adminNotes,
    events: c.events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      meta: e.meta ? JSON.parse(e.meta) : null,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
    })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });
}

type PatchBody = {
  status?: string;
  note?: string;
  message?: string;
  customerTrackingNumber?: string | null;
  adminNotes?: string;
  actor?: string; // optional override (z.B. Shop-Username)
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized" },
      { status: auth.status }
    );
  }
  const { id } = await params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.retoureCase.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const actor = body.actor ?? "api";

  if (body.status && body.status !== existing.status) {
    await transitionStatus(id, body.status, {
      actor,
      message: body.message,
    });
  }

  if (body.customerTrackingNumber !== undefined) {
    await prisma.retoureCase.update({
      where: { id },
      data: { customerTrackingNumber: body.customerTrackingNumber },
    });
    await addEvent(
      id,
      "tracking_added",
      body.customerTrackingNumber
        ? `Tracking-Nummer hinterlegt: ${body.customerTrackingNumber}`
        : "Tracking-Nummer entfernt",
      undefined,
      actor
    );
  }

  if (body.adminNotes !== undefined) {
    await prisma.retoureCase.update({
      where: { id },
      data: { adminNotes: body.adminNotes },
    });
  }

  if (body.note?.trim()) {
    await addEvent(id, "note", body.note.trim(), undefined, actor);
  }

  const updated = await prisma.retoureCase.findUnique({ where: { id } });
  return NextResponse.json({ ok: true, id, status: updated!.status });
}
