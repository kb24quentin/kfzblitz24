/**
 * POST /api/pda/containers/:containerId/close
 *
 * Schließt einen Container — status=closed, closedAt=now. Danach
 * akzeptiert /items keine weiteren Verlinkungen mehr.
 *
 * Idempotent: bereits geschlossene Container werden 200 zurückgegeben
 * (mit der unveränderten Row).
 */

import { NextResponse } from "next/server";
import { checkPdaAuth } from "@/lib/pda-auth";
import { closeContainer } from "@/lib/containers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
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

  let body: { actor?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body optional — fallthrough mit Defaults.
  }

  try {
    const c = await closeContainer(containerId, body.actor?.trim() || "pda");
    return NextResponse.json({
      container: {
        id: c.id,
        code: c.code,
        status: c.status,
        closedAt: c.closedAt?.toISOString() ?? null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
