/**
 * GET  /api/retoure        — Liste aller Cases (paginiert, filterbar)
 * Bearer-Auth via API_TOKEN.
 *
 * POST /api/retoure ist (vorerst) NICHT hier implementiert — externe Shops
 * können stattdessen den bestehenden /api/pdf Endpoint nutzen, der bereits
 * persistiert. Sobald wir einen JSON-only-Flow (ohne PDF-Rückgabe) brauchen,
 * landet er hier.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { checkBearer } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized" },
      { status: auth.status }
    );
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim() || undefined;
  const q = url.searchParams.get("q")?.trim() || undefined;
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50") || 50));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0") || 0);

  const where: Prisma.RetoureCaseWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { bestellnummer: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { dhlTrackingNumber: { contains: q } },
    ];
  }

  const [cases, total] = await Promise.all([
    prisma.retoureCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.retoureCase.count({ where }),
  ]);

  return NextResponse.json({
    total,
    offset,
    limit,
    cases: cases.map(serialize),
  });
}

function serialize(c: Awaited<ReturnType<typeof prisma.retoureCase.findFirst>>) {
  if (!c) return null;
  return {
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
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
