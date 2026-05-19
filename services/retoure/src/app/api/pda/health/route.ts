/**
 * GET /api/pda/health
 *
 * Verbindungs-Check für die Android-App.
 * Bearer-Auth Pflicht — die App testet damit ihre Credentials.
 */

import { NextResponse } from "next/server";
import { checkPdaAuth } from "@/lib/pda-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503
            ? "API_TOKEN nicht konfiguriert"
            : "Unauthorized",
      },
      { status: auth.status }
    );
  }
  return NextResponse.json({
    ok: true,
    service: "retoure-pda-api",
    serverTime: new Date().toISOString(),
  });
}
