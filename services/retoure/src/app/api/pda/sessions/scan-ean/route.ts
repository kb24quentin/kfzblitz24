/**
 * POST /api/pda/sessions/scan-ean
 *
 * Multi-Case-Variante von /api/pda/cases/[id]/scan-ean.
 *
 * Aufgerufen wenn der Worker mehrere Retourenscheine zum selben Paket
 * scannt und alle Items unified im Wizard durchgehen will (Use Case 1).
 *
 * Body:
 *   {
 *     caseIds: string[],     // mindestens 1, mehr für Multi-Schein-Sessions
 *     ean: string,
 *     pdaId?: string,
 *   }
 *
 * Routing-Logik:
 *   - Phase 1: registered match wird über ALLE caseIds versucht.
 *     Erster Treffer wins. Side-effect läuft NUR auf der gewinnenden Case.
 *   - Phase 2a: Webisco-extra wird über ALLE caseIds versucht
 *     (eine Order kann der Match-Order sein, eine andere nicht).
 *     Erster Match wins.
 *   - Phase 2b: unknown landet immer auf caseIds[0] (primärer Case).
 *
 * Response: existierender ScanEanResult + `matchedCaseId`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import {
  findRegisteredMatch,
  applyRegisteredMatch,
  lookupArticleByEan,
  isArticleInCaseOrder,
  applyExtraMatch,
  applyUnknown,
} from "@/lib/scan-ean";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Body {
  caseIds?: string[];
  ean?: string;
  pdaId?: string;
}

export async function POST(req: Request) {
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const caseIds = (body.caseIds ?? []).map((s) => s?.trim()).filter(Boolean);
  const ean = (body.ean ?? "").trim();
  if (caseIds.length === 0) {
    return NextResponse.json({ error: "caseIds fehlt" }, { status: 400 });
  }
  if (ean.length === 0) {
    return NextResponse.json({ error: "ean fehlt" }, { status: 400 });
  }

  const actor = body.pdaId ? `pda:${body.pdaId}` : "pda";

  // Validierung: alle Cases existieren?
  const found = await prisma.retoureCase.findMany({
    where: { id: { in: caseIds } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((c) => c.id));
  const missing = caseIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Cases nicht gefunden: ${missing.join(", ")}` },
      { status: 404 },
    );
  }

  // ── Phase 1: registered match über alle Cases ────────────────────
  for (const caseId of caseIds) {
    const match = await findRegisteredMatch(caseId, ean);
    if (match) {
      const result = await applyRegisteredMatch(caseId, match, ean, actor);
      return NextResponse.json({ ...result, matchedCaseId: caseId });
    }
  }

  // ── Phase 2a: Webisco-extra über alle Cases ──────────────────────
  // EINMAL via Webisco klassifizieren (EAN→Artikel), dann pro Case
  // checken ob er auf der jeweiligen Order war. Erster Match wins.
  const resolvedArticle = await lookupArticleByEan(ean);
  if (resolvedArticle?.artikelnummer) {
    for (const caseId of caseIds) {
      if (await isArticleInCaseOrder(caseId, resolvedArticle.artikelnummer)) {
        const result = await applyExtraMatch(
          caseId,
          ean,
          resolvedArticle,
          actor,
        );
        return NextResponse.json({ ...result, matchedCaseId: caseId });
      }
    }
  }

  // ── Phase 2b: unknown auf primäre Case ───────────────────────────
  const primary = caseIds[0];
  const result = await applyUnknown(primary, ean, resolvedArticle, actor);
  return NextResponse.json({ ...result, matchedCaseId: primary });
}
