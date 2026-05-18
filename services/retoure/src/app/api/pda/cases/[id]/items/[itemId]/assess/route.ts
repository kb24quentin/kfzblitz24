/**
 * POST /api/pda/cases/:id/items/:itemId/assess
 *
 * Mitarbeiter-Bewertung eines Items nach Foto-Aufnahme.
 *
 * Body:
 *   {
 *     employeeScore: number,    // 0-100
 *     verdictReason?: string,   // freier Kommentar
 *     pdaId?: string
 *   }
 *
 * Setzt status="assessed", employeeScore, scoredAt.
 * Verdict (green/yellow/red) wird erst nach Phase 5 (AI-Score) zusammengesetzt
 * — bis dahin können wir einen Naive-Verdict direkt aus employeeScore ableiten.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { addEvent } from "@/lib/retoure-cases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function naiveVerdict(score: number): "green" | "yellow" | "red" {
  if (score >= 85) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status }
    );
  }

  const { id, itemId } = await params;
  let body: { employeeScore?: number; verdictReason?: string; pdaId?: string };
  try {
    body = (await req.json()) as {
      employeeScore?: number;
      verdictReason?: string;
      pdaId?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const score = Number(body.employeeScore);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return NextResponse.json(
      { error: "employeeScore muss 0-100 sein" },
      { status: 400 }
    );
  }

  const item = await prisma.retoureItem.findUnique({ where: { id: itemId } });
  if (!item || item.caseId !== id) {
    return NextResponse.json({ error: "Item not found in case" }, { status: 404 });
  }

  // Vorläufiger Verdict aus employeeScore (Phase 5 ergänzt aiScore + Combined)
  const verdict = naiveVerdict(score);

  const updated = await prisma.retoureItem.update({
    where: { id: itemId },
    data: {
      status: "assessed",
      employeeScore: score,
      combinedScore: item.aiScore !== null ? Math.round((score + item.aiScore) / 2) : score,
      verdict,
      verdictReason: body.verdictReason ?? null,
      scoredAt: new Date(),
    },
  });

  await addEvent(
    id,
    "item_assessed",
    `Mitarbeiter-Bewertung ${score}/100 → ${verdict.toUpperCase()}`,
    { itemId, employeeScore: score, verdict, reason: body.verdictReason },
    body.pdaId ? `pda:${body.pdaId}` : "pda"
  );

  return NextResponse.json({
    ok: true,
    item: {
      id: updated.id,
      status: updated.status,
      employeeScore: updated.employeeScore,
      combinedScore: updated.combinedScore,
      verdict: updated.verdict,
    },
  });
}
