/**
 * POST /api/cases/[id]/assess — manuell ein neues Assessment auslösen.
 * Praktisch fürs API-Re-Run nach Nachreichen von Dokumenten oder fürs
 * Testen aus der Shell.
 *
 * Optional: durch API_TOKEN Bearer geschützt.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAssessment } from "@/lib/assess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(req: Request): { ok: true } | { ok: false } {
  const required = process.env.API_TOKEN?.trim();
  if (!required) return { ok: true };
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token === required ? { ok: true } : { ok: false };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authorize(req).ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const exists = await prisma.b2BCase.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Case nicht gefunden" }, { status: 404 });
  }
  const result = await runAssessment(id);
  return NextResponse.json(result);
}
