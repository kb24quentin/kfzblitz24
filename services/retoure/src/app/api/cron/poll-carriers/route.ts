/**
 * POST /api/cron/poll-carriers
 *
 * Bearer-Auth via API_TOKEN.
 * Triggert das Carrier-Polling für alle aktiven Cases (dodajpaczke /history).
 * Wird per externem Scheduler aufgerufen — z.B. GH-Actions schedule alle
 * 30 Minuten oder ein interner Cron-Container.
 *
 * Response zeigt zusammenfassend wie viele Events / Status-Wechsel passiert sind.
 */

import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { pollActiveCases } from "@/lib/polling";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // bis zu 5 Min, fürs Polling von 100+ Cases

export async function POST(req: Request) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized" },
      { status: auth.status }
    );
  }

  const startedAt = new Date();
  const results = await pollActiveCases();
  const durationMs = Date.now() - startedAt.getTime();

  const summary = {
    casesPolled: results.length,
    casesWithNewEvents: results.filter((r) => r.newEvents > 0).length,
    casesWithStatusChange: results.filter((r) => r.newCaseStatus).length,
    casesWithError: results.filter((r) => r.error).length,
    totalNewEvents: results.reduce((s, r) => s + r.newEvents, 0),
    durationMs,
    startedAt: startedAt.toISOString(),
  };

  console.log(`[cron] poll-carriers ${JSON.stringify(summary)}`);

  return NextResponse.json({
    ok: true,
    summary,
    results,
  });
}
