/**
 * POST /api/pda/cases/:id/items/:itemId/assess
 *
 * Mitarbeiter-Bewertung eines Items NACH der Foto-Aufnahme.
 *
 * Body:
 *   {
 *     employeeScore: number,    // 0-100
 *     verdictReason?: string,   // freier Kommentar (z.B. "OVP beschädigt")
 *     pdaId?: string
 *   }
 *
 * Phase 5: zusätzlich zum employeeScore aggregieren wir alle AI-Scores
 * der hochgeladenen Fotos (gewichtet mit confidence — Fotos mit hoher
 * Confidence zählen stärker). Der combinedScore ergibt sich dann aus
 * computeVerdict() (60% employee, 40% avg-AI). Der finale Verdict
 * (green/yellow/red) wird in die Item-Row geschrieben.
 *
 * Wenn keine Fotos da sind oder kein Foto AI-bewertet wurde, fällt
 * der combinedScore auf employeeScore zurück.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { addEvent } from "@/lib/retoure-cases";
import { computeVerdict } from "@/lib/verdict";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AiAnalysis {
  score?: number;
  reasoning?: string;
  confidence?: number;
  model?: string;
  runAt?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await checkPdaAuth(req);
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

  const item = await prisma.retoureItem.findUnique({
    where: { id: itemId },
    include: { photos: true },
  });
  if (!item || item.caseId !== id) {
    return NextResponse.json({ error: "Item not found in case" }, { status: 404 });
  }

  // AI-Scores aus den Foto-Analyses extrahieren
  const aiScores: number[] = [];
  const aiConfidences: number[] = [];
  for (const ph of item.photos) {
    if (!ph.aiAnalysisJson) continue;
    let parsed: AiAnalysis | null = null;
    try {
      parsed = JSON.parse(ph.aiAnalysisJson) as AiAnalysis;
    } catch {
      continue;
    }
    if (
      typeof parsed?.score === "number" &&
      Number.isFinite(parsed.score) &&
      typeof parsed?.confidence === "number" &&
      Number.isFinite(parsed.confidence)
    ) {
      aiScores.push(parsed.score);
      aiConfidences.push(parsed.confidence);
    }
  }

  const { combined, verdict } = computeVerdict(score, aiScores, aiConfidences);
  const avgAi =
    aiScores.length > 0
      ? Math.round(aiScores.reduce((a, b) => a + b, 0) / aiScores.length)
      : null;

  const updated = await prisma.retoureItem.update({
    where: { id: itemId },
    data: {
      status: "assessed",
      employeeScore: score,
      aiScore: avgAi,
      combinedScore: combined,
      verdict,
      verdictReason: body.verdictReason ?? null,
      scoredAt: new Date(),
    },
  });

  await addEvent(
    id,
    "item_assessed",
    `Bewertung Emp ${score}/100 · AI ${avgAi ?? "—"}/100 · Combined ${combined}/100 → ${verdict.toUpperCase()}`,
    {
      itemId,
      employeeScore: score,
      aiScore: avgAi,
      combinedScore: combined,
      verdict,
      photoCount: item.photos.length,
      aiPhotoCount: aiScores.length,
      reason: body.verdictReason,
    },
    body.pdaId ? `pda:${body.pdaId}` : "pda"
  );

  return NextResponse.json({
    ok: true,
    item: {
      id: updated.id,
      status: updated.status,
      employeeScore: updated.employeeScore,
      aiScore: updated.aiScore,
      combinedScore: updated.combinedScore,
      verdict: updated.verdict,
    },
    aiPhotoCount: aiScores.length,
  });
}
