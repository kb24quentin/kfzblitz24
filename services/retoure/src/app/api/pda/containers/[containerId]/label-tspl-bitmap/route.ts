/**
 * GET /api/pda/containers/:containerId/label-tspl-bitmap
 *
 * Liefert das Container-Label als **TSPL mit BITMAP-Kommandos** —
 * pixel-perfekt gerendert aus dem Dashboard-PDF-Design.
 *
 * Pipeline im Server:
 *   1. buildPalletLabelPdf(container)   → PDF-Bytes (pdf-lib)
 *   2. pdftoppm -mono -r 203            → 1bpp PBM
 *   3. wrapAsTspl (mit STRIP-Chunking)  → TSPL-Buffer mit binary BITMAP
 *
 * Response: `application/octet-stream` — Body enthält gemischt Text
 * (SIZE/GAP/CLS/PRINT) und binary Pixel-Daten. NICHT als UTF-8-String
 * behandeln, sondern als raw ByteArray direkt zum Drucker durchreichen.
 *
 * Warum ein separater Endpoint statt einer `?format=tspl-bitmap`-Variante:
 *   - Response-Content-Type ist anders (octet-stream vs text/tspl)
 *   - Sanity-Checks im PDA-Repo unterscheiden sich
 *   - Bluetooth-Drucker (Munbyn) sollen weiter das Text-TSPL kriegen —
 *     BITMAP-Chunks funktionieren dort auch, aber sind unnötig für die
 *     einfacheren Labels
 *
 * Auth: gleicher Bearer-Token wie andere /api/pda/*-Endpoints.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { buildPalletLabelPdf } from "@/lib/label-pdf";
import { pdfToTsplBitmap } from "@/lib/pdf-to-tspl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const container = await prisma.container.findUnique({
    where: { id: containerId },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          routeCode: true,
          street: true,
          postalCode: true,
          city: true,
          country: true,
        },
      },
    },
  });

  if (!container) {
    return NextResponse.json({ error: "Container not found" }, { status: 404 });
  }

  const partnerName =
    container.supplier?.name ??
    container.partnerId ??
    "(kein Lieferant)";

  const isInternal = container.supplier?.id === "kfzblitz24-internal";
  const supplier = container.supplier;
  const receiverLines =
    supplier && (supplier.street || supplier.city)
      ? [
          supplier.street ?? "",
          `${supplier.postalCode ?? ""} ${supplier.city ?? ""}`.trim(),
          (supplier.country ?? "DE").toUpperCase() === "DE"
            ? "GERMANY"
            : (supplier.country ?? "").toUpperCase() === "PL"
              ? "POLAND"
              : (supplier.country ?? "").toUpperCase(),
        ].filter((l) => l.length > 0)
      : undefined;

  // 1. PDF-Bytes exakt wie der Dashboard-Endpoint /api/admin/…/label-pdf
  const pdfBytes = await buildPalletLabelPdf({
    palletCode: container.code,
    partnerName,
    createdAt: container.openedAt,
    maxOpenUntil: container.maxOpenUntil ?? container.openedAt,
    isInternal,
    receiverLines,
    route: container.supplier?.routeCode ?? undefined,
    retoureReference: `PAL-${container.code}|${container.openedAt
      .toISOString()
      .slice(0, 10)}`,
  });

  // 2. + 3. Rasterisieren + TSPL-Wrap
  let tsplBuffer: Buffer;
  try {
    tsplBuffer = await pdfToTsplBitmap(Buffer.from(pdfBytes), {
      widthMm: 100,
      heightMm: 150,
      density: 8,
      speed: 4,
    });
  } catch (e) {
    console.error("[label-tspl-bitmap] Rasterization failed:", e);
    return NextResponse.json(
      {
        error:
          "PDF-Rasterisierung fehlgeschlagen. Ist pdftoppm im Container installiert (Dockerfile: apk add poppler-utils)?",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  return new Response(new Uint8Array(tsplBuffer), {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(tsplBuffer.length),
      "content-disposition": `inline; filename="${container.code}.tspl"`,
      "cache-control": "no-store",
    },
  });
}
