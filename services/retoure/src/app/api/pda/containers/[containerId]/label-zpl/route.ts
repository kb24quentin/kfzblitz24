/**
 * GET /api/pda/containers/:containerId/label-zpl
 *
 * Liefert das Paletten-Label als RAW ZPL-II — Bearer-geschützte
 * PDA-Variante des Admin-Endpoints. Wir brauchen beide:
 *   - /api/admin/.../label-zpl  → für die Admin-UI (NextAuth-Session)
 *   - /api/pda/.../label-zpl    → für die Android-PDA-App
 *
 * Die Trennung ist nötig weil unsere Middleware die Hosts isoliert:
 * Auf `pda.rma.*` sind ausschließlich `/api/pda/*` und `/api/cron/*`
 * erreichbar — `/api/admin/*` würde 404 zurückgeben.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { palletLabelTspl, palletLabelZpl } from "@/lib/label-print";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * `format`-Query-Param entscheidet welche Sprache:
 *   zpl  — Zebra Programming Language (echte Zebra-Drucker)
 *   tspl — TSC Printer Language (Munbyn-Portables im Default-Mode)
 * Default fällt auf `tspl` weil unsere ersten Drucker (Munbyn RW403B)
 * out-of-the-box TSPL sprechen.
 */
type LabelFormat = "zpl" | "tspl";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ containerId: string }> },
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

  const { containerId } = await ctx.params;
  const url = new URL(req.url);
  const rawFormat = (url.searchParams.get("format") ?? "tspl").toLowerCase();
  const format: LabelFormat =
    rawFormat === "zpl" ? "zpl" : "tspl"; // alles andere → tspl

  const container = await prisma.container.findUnique({
    where: { id: containerId },
    include: { supplier: { select: { name: true } } },
  });

  if (!container) {
    return NextResponse.json({ error: "Container not found" }, { status: 404 });
  }

  const partnerName =
    container.supplier?.name ?? container.partnerId ?? "(kein Lieferant)";

  const opts = {
    palletCode: container.code,
    partnerName,
    createdAt: container.openedAt,
    maxOpenUntil: container.maxOpenUntil ?? container.openedAt,
  };

  const body = format === "zpl" ? palletLabelZpl(opts) : palletLabelTspl(opts);
  const contentType =
    format === "zpl"
      ? "application/zpl; charset=utf-8"
      : "application/tspl; charset=utf-8";
  const ext = format === "zpl" ? "zpl" : "tspl";

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(Buffer.byteLength(body, "utf8")),
      "content-disposition": `inline; filename="${container.code}.${ext}"`,
      "cache-control": "no-store",
    },
  });
}
