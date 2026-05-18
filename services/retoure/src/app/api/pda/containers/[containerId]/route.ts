/**
 * GET /api/pda/containers/:containerId
 *
 * Liefert die Detail-View eines Containers für die PDA-App — Stamm-
 * daten + alle verlinkten Items (RetoureItem-Rows).
 *
 * 404 wenn kein Container mit dieser ID existiert.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ containerId: string }> },
) {
  const auth = checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status },
    );
  }

  const { containerId } = await ctx.params;
  const container = await prisma.container.findUnique({
    where: { id: containerId },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          case: {
            select: {
              id: true,
              bestellnummer: true,
              customerVorname: true,
              customerName: true,
            },
          },
        },
      },
    },
  });

  if (!container) {
    return NextResponse.json(
      { error: "Container nicht gefunden", containerId },
      { status: 404 },
    );
  }

  return NextResponse.json({
    container: {
      id: container.id,
      code: container.code,
      type: container.type,
      partnerId: container.partnerId,
      status: container.status,
      openedAt: container.openedAt.toISOString(),
      closedAt: container.closedAt?.toISOString() ?? null,
      maxOpenUntil: container.maxOpenUntil?.toISOString() ?? null,
      createdByPda: container.createdByPda,
      shippedTrackingNumber: container.shippedTrackingNumber,
      notes: container.notes,
      itemCount: container.items.length,
      items: container.items.map((it) => ({
        id: it.id,
        caseId: it.caseId,
        bestellnummer: it.case.bestellnummer,
        customer: [it.case.customerVorname, it.case.customerName]
          .filter(Boolean)
          .join(" "),
        source: it.source,
        status: it.status,
        artikelnummer: it.artikelnummer,
        hersteller: it.hersteller,
        beschreibung: it.beschreibung,
        menge: it.menge,
        grund: it.grund,
        verdict: it.verdict,
      })),
    },
  });
}
