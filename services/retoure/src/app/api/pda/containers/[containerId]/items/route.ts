/**
 * POST /api/pda/containers/:containerId/items
 *
 * Verlinkt ein bestehendes RetoureItem mit diesem Container.
 * Body: { itemId: string }
 *
 * Setzt automatisch RetoureItem.status="on_pallet" und schreibt ein
 * Event "item_linked_to_container" ins RetoureEvent-Log.
 *
 * 400 wenn itemId fehlt, 404 wenn Item oder Container nicht existiert,
 * 409 wenn der Container nicht "open" ist.
 */

import { NextResponse } from "next/server";
import { checkPdaAuth } from "@/lib/pda-auth";
import { linkItemToContainer } from "@/lib/containers";

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

  let body: { itemId?: string; actor?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body ist kein JSON" }, { status: 400 });
  }

  const itemId = body.itemId?.trim();
  if (!itemId) {
    return NextResponse.json({ error: "itemId fehlt" }, { status: 400 });
  }

  try {
    const item = await linkItemToContainer(
      itemId,
      containerId,
      body.actor?.trim() || "pda",
    );
    return NextResponse.json({
      item: {
        id: item.id,
        caseId: item.caseId,
        containerId: item.containerId,
        status: item.status,
        artikelnummer: item.artikelnummer,
        beschreibung: item.beschreibung,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("nicht offen")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
