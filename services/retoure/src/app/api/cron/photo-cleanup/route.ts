/**
 * GET /api/cron/photo-cleanup
 *
 * Cron-Worker für PendingPhoto-Cleanup. Wird alle ~30 Min getriggert.
 * Löscht Photos die älter als 1h sind und nie zu einem Item promoted
 * wurden (Customer hat Submit nicht durchgezogen).
 *
 * Auth: Bearer CRON_TOKEN.
 */
import { NextResponse } from "next/server";
import { cleanupExpiredPendingPhotos } from "@/lib/pending-photos";

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

  const result = await cleanupExpiredPendingPhotos();
  return NextResponse.json({
    ok: true,
    ...result,
    timestamp: new Date().toISOString(),
  });
}
