/**
 * GET /api/pda/cases/:id
 *
 * Vollständige Case-Daten inkl. der echten RetoureItem-Rows (nicht mehr
 * der itemsJson-Snapshot — das ist nur noch Audit-Log der Anmeldung).
 * Items werden mit Status, Source, Bewertung etc. zurückgegeben so dass
 * die PDA-App den kompletten Workflow rendern kann.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { enrichCaseItemsWithEan } from "@/lib/retoure-ean";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status }
    );
  }

  const { id } = await params;
  const c = await prisma.retoureCase.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          supplier: { select: { id: true, name: true } },
          container: { select: { id: true, code: true } },
        },
      },
    },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Lazy EAN-Enrichment: für alle Items ohne eanCode einmal Webisco
  // anfragen und die Codes nachladen. Idempotent, läuft pro Case nur
  // beim ersten Lookup. Bei Webisco-Down: warm fail (Items behalten
  // eanCode=null, Mitarbeiter bestätigt manuell). Wir blockieren den
  // Case-Lookup deshalb NICHT — er antwortet auch ohne EANs zügig.
  await enrichCaseItemsWithEan(c.id);
  // Re-fetch nur die Items damit die `eanCode`-Spalte aktuell ist.
  const freshItems = await prisma.retoureItem.findMany({
    where: { caseId: c.id },
    orderBy: { createdAt: "asc" },
    include: {
      supplier: { select: { id: true, name: true } },
      container: { select: { id: true, code: true } },
    },
  });
  c.items = freshItems;

  return NextResponse.json({
    id: c.id,
    bestellnummer: c.bestellnummer,
    belegId: c.belegId,
    belegnummer: c.belegnummer,
    belegdatum: c.belegdatum,
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
    },
    customerTrackingNumber: c.customerTrackingNumber,
    additionalTrackings: (() => {
      try {
        const parsed = JSON.parse(c.additionalTrackings || "[]");
        return Array.isArray(parsed) ? parsed.filter((s: unknown) => typeof s === "string") : [];
      } catch {
        return [] as string[];
      }
    })(),
    carrierDeliveredAt: c.carrierDeliveredAt?.toISOString() ?? null,
    partnerReceivedAt: c.partnerReceivedAt?.toISOString() ?? null,
    scanCompletedAt: c.scanCompletedAt?.toISOString() ?? null,
    money: {
      warenwertBrutto: c.warenwertBrutto,
      labelFeeBrutto: c.labelFeeBrutto,
      voraussichtlicheErstattung: c.voraussichtlicheErstattung,
    },
    items: c.items.map(serializeItem),
    events: c.events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      meta: e.meta ? safeJSON(e.meta) : null,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
    })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });
}

export function serializeItem(it: {
  id: string;
  source: string;
  status: string;
  artikelnummer: string | null;
  hersteller: string | null;
  beschreibung: string | null;
  menge: number;
  grund: string | null;
  einzelpreis_brutto: number | null;
  gesamtpreis_brutto: number | null;
  einzelgewicht_g: number | null;
  einkaufspreis_brutto: number | null;
  einspeiserid?: number | null;
  eanCode?: string | null;
  receivedAt: Date | null;
  receivedByPda: string | null;
  scanCount: number;
  employeeScore: number | null;
  aiScore: number | null;
  combinedScore: number | null;
  verdict: string | null;
  verdictReason: string | null;
  scoredAt: Date | null;
  photoCount: number;
  containerId: string | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  container?: { id: string; code: string } | null;
}) {
  return {
    id: it.id,
    source: it.source,
    status: it.status,
    artikelnummer: it.artikelnummer,
    hersteller: it.hersteller,
    beschreibung: it.beschreibung,
    menge: it.menge,
    grund: it.grund,
    einzelpreis_brutto: it.einzelpreis_brutto,
    gesamtpreis_brutto: it.gesamtpreis_brutto,
    einzelgewicht_g: it.einzelgewicht_g,
    einkaufspreis_brutto: it.einkaufspreis_brutto,
    einspeiserid: it.einspeiserid ?? null,
    eanCode: it.eanCode ?? null,
    receivedAt: it.receivedAt?.toISOString() ?? null,
    receivedByPda: it.receivedByPda,
    scanCount: it.scanCount,
    // Flach + verschachtelt: das PDA-UI nutzt item.verdict direkt; der
    // Admin-Detail-View liest .score.* — beides versorgen.
    verdict: it.verdict,
    score: {
      employee: it.employeeScore,
      ai: it.aiScore,
      combined: it.combinedScore,
      verdict: it.verdict,
      verdictReason: it.verdictReason,
      at: it.scoredAt?.toISOString() ?? null,
    },
    photoCount: it.photoCount,
    containerId: it.containerId,
    containerCode: it.container?.code ?? null,
    supplierId: it.supplierId ?? null,
    supplierName: it.supplier?.name ?? null,
  };
}

function safeJSON(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
