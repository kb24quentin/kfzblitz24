/**
 * GET /api/retoure/by-customer?email=...&limit=20&offset=0
 *
 * Customer-Account-Listenansicht „Meine Retouren". Live-Pull, kein Cache.
 *
 * Email-Match ist case-insensitive (`mode: insensitive`). Pagination via
 * Limit/Offset. Default-Sortierung: createdAt desc (neueste zuerst).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkBearer } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status },
    );
  }

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "email_missing" }, { status: 400 });
  }

  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20") || 20),
  );
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0") || 0);

  const where = {
    customerEmail: { equals: email, mode: "insensitive" as const },
  };

  const [cases, total] = await Promise.all([
    prisma.retoureCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        bestellnummer: true,
        belegnummer: true,
        kategorie: true,
        status: true,
        source: true,
        createdAt: true,
        updatedAt: true,
        eligibleUntil: true,
        warenwertBrutto: true,
        voraussichtlicheErstattung: true,
        tatsaechlicheErstattung: true,
      },
    }),
    prisma.retoureCase.count({ where }),
  ]);

  return NextResponse.json({
    cases: cases.map((c) => ({
      id: c.id,
      bestellnummer: c.bestellnummer,
      belegnummer: c.belegnummer,
      kategorie: c.kategorie,
      status: c.status,
      source: c.source,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      eligibleUntil: c.eligibleUntil?.toISOString() ?? null,
      warenwertBrutto: c.warenwertBrutto,
      voraussichtlicheErstattung: c.voraussichtlicheErstattung,
      tatsaechlicheErstattung: c.tatsaechlicheErstattung,
    })),
    total,
    limit,
    offset,
  });
}
