/**
 * SLA-Logik: welche Cases warten zu lange darauf, dass der Partner sie scannt?
 *
 * Definition "overdue":
 *   DHL hat geliefert (carrierDeliveredAt gesetzt)
 *   UND Partner hat noch nicht gescannt (partnerReceivedAt = null)
 *   UND seit carrierDeliveredAt > SLA_THRESHOLD_HOURS vergangen
 *
 * Wird vom 9-Uhr-Mail-Cron benutzt und kann später auch im Admin-Dashboard
 * als "Auffälligkeiten"-Liste gerendert werden.
 */

import { prisma } from "./db";

export interface OverdueCase {
  id: string;
  bestellnummer: string;
  dhlTrackingNumber: string | null;
  carrierDeliveredAt: Date;
  hoursOverdue: number;
  status: string;
  customerName: string | null;
  customerPlz: string | null;
  customerOrt: string | null;
}

const SLA_THRESHOLD_HOURS_DEFAULT = 48;

export function getSlaThresholdHours(): number {
  const env = process.env.SLA_THRESHOLD_HOURS;
  if (!env) return SLA_THRESHOLD_HOURS_DEFAULT;
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? n : SLA_THRESHOLD_HOURS_DEFAULT;
}

/**
 * Liefert alle Cases die "overdue" sind — DHL hat geliefert, Partner hat
 * noch nicht gescannt, und das schon länger als der SLA-Schwellenwert.
 */
export async function findOverdueCases(
  thresholdHours = getSlaThresholdHours()
): Promise<OverdueCase[]> {
  const now = Date.now();
  const cutoff = new Date(now - thresholdHours * 60 * 60 * 1000);

  const rows = await prisma.retoureCase.findMany({
    where: {
      carrierDeliveredAt: { lt: cutoff, not: null },
      partnerReceivedAt: null,
      status: { notIn: ["erstattet", "abgelehnt", "storniert"] },
    },
    select: {
      id: true,
      bestellnummer: true,
      dhlTrackingNumber: true,
      carrierDeliveredAt: true,
      status: true,
      customerVorname: true,
      customerName: true,
      customerPlz: true,
      customerOrt: true,
    },
    orderBy: { carrierDeliveredAt: "asc" },
  });

  return rows
    .filter((r) => r.carrierDeliveredAt !== null)
    .map((r) => {
      const delivered = r.carrierDeliveredAt as Date;
      const hoursOverdue =
        (now - delivered.getTime()) / (60 * 60 * 1000) - thresholdHours;
      return {
        id: r.id,
        bestellnummer: r.bestellnummer,
        dhlTrackingNumber: r.dhlTrackingNumber,
        carrierDeliveredAt: delivered,
        hoursOverdue: Math.max(0, hoursOverdue),
        status: r.status,
        customerName: [r.customerVorname, r.customerName].filter(Boolean).join(" ") || null,
        customerPlz: r.customerPlz,
        customerOrt: r.customerOrt,
      };
    });
}

/**
 * Formatiert die Overdue-Liste als Plain-Text Mail-Body.
 */
export function formatOverdueMailBody(cases: OverdueCase[], thresholdHours: number): string {
  if (cases.length === 0) {
    return `Status-Check ${new Date().toLocaleDateString("de-DE")}\n\nKeine überfälligen Retouren — alles im SLA. 👍\n`;
  }

  const lines = [
    `Status-Check ${new Date().toLocaleDateString("de-DE")}`,
    "",
    `Diese ${cases.length} Sendungen liegen laut DHL beim Partner, wurden aber noch nicht gescannt:`,
    `(SLA-Grenze: ${thresholdHours} Std. nach DHL-"zugestellt"-Scan)`,
    "",
  ];
  for (const c of cases) {
    lines.push(
      `• ${c.bestellnummer} — ${c.customerName ?? "—"} (${c.customerPlz ?? ""} ${c.customerOrt ?? ""})`
    );
    lines.push(
      `  DHL: ${c.dhlTrackingNumber ?? "—"}  ·  zugestellt: ${c.carrierDeliveredAt.toLocaleString("de-DE")}  ·  überfällig: ${c.hoursOverdue.toFixed(0)} h`
    );
  }
  lines.push("");
  lines.push("→ Bitte beim Partner nachhaken oder im RMA-Dashboard prüfen:");
  lines.push("   https://rma.kfzblitz24-group.com");
  return lines.join("\n");
}
