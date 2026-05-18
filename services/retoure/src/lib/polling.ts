/**
 * Carrier-Tracking-Polling für aktive Retoure-Cases.
 *
 * Wird per Cron (GH-Actions oder externer Scheduler) alle ~30 Min aufgerufen.
 *
 * Strategie:
 * - Iteriere alle Cases mit Status NICHT in {erstattet, abgelehnt, storniert}
 *   und mit dhlShipmentId vorhanden.
 * - Hole /shipments/{id}/history von dodajpaczke.
 * - Vergleiche mit den schon gespeicherten carrier_event-Events (per createdAt-Stempel).
 * - Neue Entries:
 *     1. Anlegen als RetoureEvent type=carrier_event
 *     2. Falls Status-Mapping einen neuen Case-Status hergibt: transitionStatus()
 */

import { prisma } from "./db";
import {
  fetchShipmentHistory,
  mapCarrierStatusToCaseStatus,
  type ShipmentHistoryEntry,
} from "./dodajpaczke";
import { transitionStatus } from "./retoure-cases";

const ACTIVE_STATUSES = [
  "angemeldet",
  "versandt",
  "unterwegs",
  "eingang_partner",
  "pruefung",
];

export interface PollResult {
  caseId: string;
  bestellnummer: string;
  shipmentId: number;
  newEvents: number;
  newCaseStatus?: string;
  error?: string;
}

export async function pollActiveCases(): Promise<PollResult[]> {
  const cases = await prisma.retoureCase.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      dhlShipmentId: { not: null },
    },
    select: {
      id: true,
      bestellnummer: true,
      dhlShipmentId: true,
      status: true,
    },
    take: 200, // Sanity-Limit pro Run
  });

  const results: PollResult[] = [];
  for (const c of cases) {
    const r = await pollOneCase(c.id, c.bestellnummer, c.dhlShipmentId!, c.status);
    results.push(r);
  }
  return results;
}

export async function pollOneCase(
  caseId: string,
  bestellnummer: string,
  shipmentId: number,
  currentStatus: string
): Promise<PollResult> {
  const result: PollResult = {
    caseId,
    bestellnummer,
    shipmentId,
    newEvents: 0,
  };

  const history = await fetchShipmentHistory(shipmentId);
  if (!history.ok) {
    result.error =
      "skipped" in history && history.skipped ? history.reason : history.error;
    return result;
  }

  // Bereits gespeicherte carrier_event-Events laden (für Deduplizierung)
  const existing = await prisma.retoureEvent.findMany({
    where: { caseId, type: "carrier_event" },
    select: { meta: true },
  });
  const seenKeys = new Set<string>();
  for (const e of existing) {
    if (!e.meta) continue;
    try {
      const m = JSON.parse(e.meta) as Partial<ShipmentHistoryEntry>;
      if (m.createdAt && m.status) {
        seenKeys.add(`${m.createdAt}|${m.status}`);
      }
    } catch {
      /* ignore */
    }
  }

  // Neue Entries chronologisch verarbeiten
  const sorted = [...history.entries].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );

  let workingStatus = currentStatus;
  for (const entry of sorted) {
    const key = `${entry.createdAt}|${entry.status}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    // Event in Timeline schreiben
    await prisma.retoureEvent.create({
      data: {
        caseId,
        type: "carrier_event",
        message: entry.message || `Carrier: ${entry.status}`,
        meta: JSON.stringify(entry),
        actor: "carrier:dhl",
      },
    });
    result.newEvents += 1;

    // Status-Wechsel?
    const newStatus = mapCarrierStatusToCaseStatus(entry.status, workingStatus);
    if (newStatus && newStatus !== workingStatus) {
      await transitionStatus(caseId, newStatus, {
        actor: "carrier:dhl",
        message: `Auto-Wechsel via Carrier-Event "${entry.status}"`,
        meta: { entry },
      });
      workingStatus = newStatus;
      result.newCaseStatus = newStatus;

      // SLA-Stempel: carrierDeliveredAt setzen wenn DHL "delivered" reportet.
      // Damit weiß die 9-Uhr-Mail wie lange das Paket schon beim Partner
      // liegen sollte aber noch nicht physisch gescannt wurde.
      if (newStatus === "eingang_partner") {
        await prisma.retoureCase.updateMany({
          where: { id: caseId, carrierDeliveredAt: null },
          data: { carrierDeliveredAt: new Date(entry.createdAt.replace(" ", "T").replace(/\.\d+$/, "")) },
        });
      }
    }
  }

  return result;
}
