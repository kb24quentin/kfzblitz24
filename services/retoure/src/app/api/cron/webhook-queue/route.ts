/**
 * GET /api/cron/webhook-queue
 *
 * Cron-Worker für Webhook-Retry. Wird via Coolify/GitHub-Cron alle 1-2
 * Minuten getriggert. Verarbeitet bis zu 50 pending+overdue
 * WebhookDelivery-Rows pro Aufruf.
 *
 * Auth: Bearer (CRON_TOKEN env-var, separat vom API_TOKEN).
 */
import { NextResponse } from "next/server";
import { runDeliveryQueue } from "@/lib/webhook-dispatcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const required = process.env.CRON_TOKEN?.trim();
  if (!required) {
    return NextResponse.json(
      { error: "CRON_TOKEN nicht konfiguriert" },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== required) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDeliveryQueue({ limit: 50 });

  return NextResponse.json({
    ok: true,
    ...result,
    timestamp: new Date().toISOString(),
  });
}
