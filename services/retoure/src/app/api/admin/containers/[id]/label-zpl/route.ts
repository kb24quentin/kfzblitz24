/**
 * GET /api/admin/containers/:id/label-zpl
 *
 * Liefert das Paletten-Label als RAW ZPL-II — gedacht für Drucker,
 * die ZPL direkt verstehen (Munbyn RW403B, Zebra ZD-Serie, etc.).
 *
 * Transport-agnostisch: wir geben nur die Bytes. Wer sie zum
 * Drucker schickt entscheidet der Client:
 *   - PDA-App (Bluetooth-SPP):  fetch → BluetoothSocket.outputStream
 *   - Backend (WiFi TCP:9100):  fetch nicht nötig, direkt
 *                               `sendZplToPrinter(zpl, host)` aus
 *                               `@/lib/label-print` benutzen.
 *   - Admin am PC:               curl/Browser-Download → an die
 *                               Munbyn-Editor-Software übergeben.
 *
 * Auth: gleich wie der PDF-Endpoint — Bearer-Token (PDA) ODER
 * NextAuth-Session (Admin-UI).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkPdaAuth } from "@/lib/pda-auth";
import { palletLabelZpl } from "@/lib/label-print";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function isAuthorized(req: Request): Promise<boolean> {
  if (req.headers.get("authorization")) {
    const r = await checkPdaAuth(req);
    if (r.ok) return true;
  }
  const session = await auth();
  return !!session?.user?.email;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const container = await prisma.container.findUnique({
    where: { id },
    include: { supplier: { select: { name: true } } },
  });

  if (!container) {
    return NextResponse.json({ error: "Container not found" }, { status: 404 });
  }

  const partnerName =
    container.supplier?.name ?? container.partnerId ?? "(kein Lieferant)";

  const zpl = palletLabelZpl({
    palletCode: container.code,
    partnerName,
    createdAt: container.openedAt,
    maxOpenUntil: container.maxOpenUntil ?? container.openedAt,
  });

  // ZPL ist ASCII/UTF-8 — wir liefern als `application/zpl` (de-facto-
  // MIME, kein offizieller Eintrag) und stellen `inline` als
  // Disposition, damit Browser den Text anzeigen statt einen Download
  // zu erzwingen. Die PDA-App fragt sowieso mit Accept: application/zpl.
  return new Response(zpl, {
    status: 200,
    headers: {
      "content-type": "application/zpl; charset=utf-8",
      "content-length": String(Buffer.byteLength(zpl, "utf8")),
      "content-disposition": `inline; filename="${container.code}.zpl"`,
      "cache-control": "no-store",
    },
  });
}
