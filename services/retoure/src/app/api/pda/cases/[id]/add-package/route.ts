/**
 * POST /api/pda/cases/:id/add-package
 *
 * Worker fügt einer bestehenden Retoure ein weiteres Paket hinzu —
 * Multi-Paket-Szenario (Kunde hat z. B. 5 Items in 2 Boxen verteilt).
 *
 * Body: { tracking: string, pdaId?: string }
 *
 * Logik:
 *   - Falls customerTrackingNumber/dhlTrackingNumber noch leer ist,
 *     wird die Nummer dort gespeichert (primary).
 *   - Sonst wird sie in additionalTrackings (JSON-Array) angehängt
 *     (sofern noch nicht enthalten).
 *   - Timeline-Event "tracking_added".
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AddPackageBody {
  tracking?: string;
  pdaId?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status },
    );
  }

  const { id } = await params;
  let body: AddPackageBody = {};
  try {
    body = (await req.json()) as AddPackageBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tracking = (body.tracking ?? "").trim();
  if (!tracking) {
    return NextResponse.json({ error: "tracking fehlt" }, { status: 400 });
  }

  const actor = body.pdaId ? `pda:${body.pdaId}` : "pda";

  const c = await prisma.retoureCase.findUnique({
    where: { id },
    select: {
      id: true,
      customerTrackingNumber: true,
      dhlTrackingNumber: true,
      additionalTrackings: true,
    },
  });
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const primary = c.customerTrackingNumber ?? c.dhlTrackingNumber;
  if (!primary) {
    // Noch kein Tracking → als primary speichern
    await prisma.retoureCase.update({
      where: { id },
      data: { customerTrackingNumber: tracking },
    });
    await prisma.retoureEvent.create({
      data: {
        caseId: id,
        type: "tracking_added",
        message: `Paket-Tracking ergänzt: ${tracking}`,
        meta: JSON.stringify({ source: "pda-add-package", tracking, position: "primary" }),
        actor,
      },
    });
    return NextResponse.json({
      ok: true,
      tracking,
      position: "primary",
      message: "Paket-Tracking als Haupt-Tracking gespeichert.",
    });
  }

  if (primary === tracking) {
    return NextResponse.json({
      ok: true,
      tracking,
      position: "primary",
      message: "Dieses Tracking ist bereits das Haupt-Tracking.",
      alreadyKnown: true,
    });
  }

  // Sonst: Multi-Paket-Append
  let existing: string[] = [];
  try {
    const parsed = JSON.parse(c.additionalTrackings || "[]");
    if (Array.isArray(parsed)) existing = parsed.filter((s) => typeof s === "string");
  } catch { /* fall back to empty */ }

  if (existing.includes(tracking)) {
    return NextResponse.json({
      ok: true,
      tracking,
      position: "additional",
      message: "Tracking ist bereits am Case hinterlegt.",
      alreadyKnown: true,
    });
  }

  existing.push(tracking);
  await prisma.retoureCase.update({
    where: { id },
    data: { additionalTrackings: JSON.stringify(existing) },
  });
  await prisma.retoureEvent.create({
    data: {
      caseId: id,
      type: "tracking_added",
      message: `Weiteres Paket ergänzt: ${tracking} (Paket #${existing.length + 1})`,
      meta: JSON.stringify({
        source: "pda-add-package",
        tracking,
        position: "additional",
        total: existing.length + 1,
      }),
      actor,
    },
  });

  return NextResponse.json({
    ok: true,
    tracking,
    position: "additional",
    total: existing.length + 1,
    message: `Paket #${existing.length + 1} ergänzt`,
  });
}
