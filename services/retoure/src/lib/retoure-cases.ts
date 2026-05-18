/**
 * Persistenz-Helfer für RetoureCase + RetoureEvent.
 *
 * Wird vom PDF-Route-Handler aufgerufen NACHDEM die PDF erzeugt wurde —
 * Fehler hier sollten den Customer-Flow nicht brechen, deshalb wrapen die
 * Aufrufer das in try/catch und loggen nur.
 */

import { prisma } from "./db";

export interface CustomerSnapshot {
  anrede?: string;
  vorname?: string;
  name?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  email?: string;
  telefon?: string;
  handy?: string;
}

export interface RetoureItemSnapshot {
  artikelnummer?: string;
  hersteller?: string;
  beschreibung?: string;
  menge: number;
  grund: string;
  einzelpreis_brutto?: number;
  gesamtpreis_brutto?: number;
  einzelgewicht_g?: number;
}

export interface CreateRetoureCaseInput {
  bestellnummer: string;
  belegId?: string | number;
  belegnummer?: string;
  belegdatum?: string;
  customer?: CustomerSnapshot;
  items: RetoureItemSnapshot[];
  warenwertBrutto: number;
  labelFeeBrutto: number;
  voraussichtlicheErstattung: number;
  shippingMode: "standard" | "sicher" | "unknown";
  labelRequested: boolean;
  labelPaid: boolean;
  dhlShipmentId?: number;
  dhlTrackingNumber?: string;
  dhlRetoureIdc?: string;
  weightSentKg?: number;
}

/**
 * Legt einen neuen RetoureCase an und schreibt direkt ein "case_created"
 * Event. Items werden zusätzlich zum Snapshot-JSON als echte RetoureItem-Rows
 * gespeichert (source=registered, status=pending).
 */
export async function createCase(input: CreateRetoureCaseInput) {
  return await prisma.$transaction(async (tx) => {
    const c = await tx.retoureCase.create({
      data: {
        bestellnummer: input.bestellnummer,
        belegId: input.belegId !== undefined ? String(input.belegId) : null,
        belegnummer: input.belegnummer ?? null,
        belegdatum: input.belegdatum ?? null,
        customerAnrede: input.customer?.anrede ?? null,
        customerVorname: input.customer?.vorname ?? null,
        customerName: input.customer?.name ?? null,
        customerStrasse: input.customer?.strasse ?? null,
        customerPlz: input.customer?.plz ?? null,
        customerOrt: input.customer?.ort ?? null,
        customerEmail: input.customer?.email ?? null,
        customerTelefon: input.customer?.telefon ?? null,
        customerHandy: input.customer?.handy ?? null,
        // JSON-Snapshot bleibt als Audit-Log der ursprünglichen Anmeldung
        itemsJson: JSON.stringify(input.items),
        warenwertBrutto: input.warenwertBrutto,
        labelFeeBrutto: input.labelFeeBrutto,
        voraussichtlicheErstattung: input.voraussichtlicheErstattung,
        shippingMode:
          input.shippingMode === "unknown" ? "standard" : input.shippingMode,
        labelRequested: input.labelRequested,
        labelPaid: input.labelPaid,
        dhlShipmentId: input.dhlShipmentId ?? null,
        dhlTrackingNumber: input.dhlTrackingNumber ?? null,
        dhlRetoureIdc: input.dhlRetoureIdc ?? null,
        weightSentKg: input.weightSentKg ?? null,
        status: "angemeldet",
      },
    });

    // Items als eigene Rows
    if (input.items.length > 0) {
      await tx.retoureItem.createMany({
        data: input.items.map((it) => ({
          caseId: c.id,
          source: "registered",
          status: "pending",
          artikelnummer: it.artikelnummer ?? null,
          hersteller: it.hersteller ?? null,
          beschreibung: it.beschreibung ?? null,
          menge: it.menge,
          grund: it.grund,
          einzelpreis_brutto: it.einzelpreis_brutto ?? null,
          gesamtpreis_brutto: it.gesamtpreis_brutto ?? null,
          einzelgewicht_g: it.einzelgewicht_g ?? null,
        })),
      });
    }

    await tx.retoureEvent.create({
      data: {
        caseId: c.id,
        type: "case_created",
        message: "Retoure angemeldet",
        meta: JSON.stringify({
          bestellnummer: input.bestellnummer,
          itemCount: input.items.length,
        }),
        actor: "system",
      },
    });

    return c;
  });
}

/**
 * Schreibt ein Event ins Timeline-Log eines Cases.
 */
export async function addEvent(
  caseId: string,
  type: string,
  message?: string,
  meta?: Record<string, unknown>,
  actor: string = "system"
) {
  await prisma.retoureEvent.create({
    data: {
      caseId,
      type,
      message: message ?? null,
      meta: meta ? JSON.stringify(meta) : null,
      actor,
    },
  });
}

/**
 * Status-Wechsel mit Timeline-Eintrag in einer Transaktion.
 */
export async function transitionStatus(
  caseId: string,
  newStatus: string,
  options: { actor?: string; message?: string; meta?: Record<string, unknown> } = {}
) {
  const c = await prisma.retoureCase.findUnique({ where: { id: caseId } });
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const oldStatus = c.status;
  if (oldStatus === newStatus) return c;

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.retoureCase.update({
      where: { id: caseId },
      data: { status: newStatus },
    });
    await tx.retoureEvent.create({
      data: {
        caseId,
        type: "status_change",
        message:
          options.message ?? `Status: ${oldStatus} → ${newStatus}`,
        meta: JSON.stringify({
          oldStatus,
          newStatus,
          ...(options.meta ?? {}),
        }),
        actor: options.actor ?? "system",
      },
    });
    return updated;
  });
}
