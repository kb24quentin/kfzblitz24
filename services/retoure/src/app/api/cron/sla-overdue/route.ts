/**
 * POST /api/cron/sla-overdue
 *
 * Bearer-Auth (API_TOKEN).
 * Findet alle Cases die laut DHL beim Partner liegen aber noch nicht
 * gescannt wurden, jenseits des SLA-Schwellenwerts.
 *
 * Wird vom Cron-Sidecar einmal täglich um 09:00 Uhr Europe/Berlin
 * aufgerufen. Sendet (falls Resend konfiguriert) eine Mail an SLA_MAIL_TO.
 *
 * Antwort: JSON-Summary für Observability.
 */

import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { findOverdueCases, formatOverdueMailBody, getSlaThresholdHours } from "@/lib/sla";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized" },
      { status: auth.status }
    );
  }

  const threshold = getSlaThresholdHours();
  const overdue = await findOverdueCases(threshold);
  const body = formatOverdueMailBody(overdue, threshold);

  const mailTo = process.env.SLA_MAIL_TO?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  let mailStatus: "sent" | "skipped_no_recipient" | "skipped_no_resend" | "failed" =
    "skipped_no_recipient";
  let mailError: string | undefined;

  if (mailTo && resendKey && overdue.length > 0) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:
            process.env.SLA_MAIL_FROM?.trim() ||
            "Retouren-System <noreply@kfzblitz24-group.com>",
          to: [mailTo],
          subject: `Retouren-SLA — ${overdue.length} Sendungen überfällig`,
          text: body,
        }),
      });
      if (res.ok) {
        mailStatus = "sent";
      } else {
        mailStatus = "failed";
        mailError = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      }
    } catch (e) {
      mailStatus = "failed";
      mailError = e instanceof Error ? e.message : String(e);
    }
  } else if (overdue.length === 0) {
    mailStatus = "skipped_no_recipient"; // nichts zu mailen, alles im SLA
  } else if (!resendKey) {
    mailStatus = "skipped_no_resend";
  }

  // Auch ohne Mail-Setup: Body ins Log für Observability
  console.log(`[cron] sla-overdue threshold=${threshold}h overdue=${overdue.length} mail=${mailStatus}`);
  if (mailError) console.warn(`[cron] sla-overdue mail-error: ${mailError}`);
  if (overdue.length > 0) console.log(body);

  return NextResponse.json({
    ok: true,
    threshold,
    overdueCount: overdue.length,
    overdue: overdue.map((o) => ({
      bestellnummer: o.bestellnummer,
      dhlTrackingNumber: o.dhlTrackingNumber,
      hoursOverdue: Math.round(o.hoursOverdue),
      customerOrt: o.customerOrt,
    })),
    mailStatus,
    mailError,
  });
}
