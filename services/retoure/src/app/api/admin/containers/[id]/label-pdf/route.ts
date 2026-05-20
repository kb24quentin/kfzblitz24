/**
 * GET /api/admin/containers/:id/label-pdf
 *
 * Liefert das Paletten-Label des Containers als PDF (A6).
 * Übergangs-Lösung bis der TSC-TE210-Netzwerk-Drucker im Lager hängt:
 * Admin/PDA lädt das PDF, druckt es per Bluetooth/AirPrint/etc.
 *
 * Auth: für Admin-UI über NextAuth-Session ODER per Bearer-Token
 * (gleicher Mechanismus wie /api/pda/*) — so kann das PDA selbst auch
 * direkt downloaden ohne Re-Login.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkPdaAuth } from "@/lib/pda-auth";
import { buildPalletLabelPdf } from "@/lib/label-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function isAuthorized(req: Request): Promise<boolean> {
  // Bearer-Token? Dann gegen PdaDevice / shared API_TOKEN prüfen
  if (req.headers.get("authorization")) {
    const r = await checkPdaAuth(req);
    if (r.ok) return true;
  }
  // Sonst NextAuth-Session prüfen (Admin-UI)
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
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
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

  // Receiver-Adresszeilen für das Routing-Label (Designguide §7.4):
  // Letzte Zeile = Land in CAPS. Wenn die Stammdaten leer sind, bekommt
  // der Designguide-Fallback aus label-pdf.ts den Job.
  const supplier = container.supplier;
  const receiverLines = !isInternal && supplier && (supplier.street || supplier.city)
    ? [
        supplier.street ?? "",
        `${supplier.postalCode ?? ""} ${supplier.city ?? ""}`.trim(),
        (supplier.country ?? "DE").toUpperCase() === "DE" ? "GERMANY"
          : (supplier.country ?? "").toUpperCase() === "PL" ? "POLAND"
          : (supplier.country ?? "").toUpperCase(),
      ].filter((l) => l.length > 0)
    : undefined;

  const pdfBytes = await buildPalletLabelPdf({
    palletCode: container.code,
    partnerName,
    createdAt: container.openedAt,
    maxOpenUntil: container.maxOpenUntil ?? container.openedAt,
    isInternal,
    receiverLines,
    retoureReference: `PAL-${container.code}|${container.openedAt
      .toISOString()
      .slice(0, 10)}`,
  });

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-length": String(pdfBytes.length),
      // inline statt attachment: Browser zeigt das PDF direkt an und
      // bietet "Drucken" über die Browser-Funktion an. Wer's lokal
      // speichern will, klickt "Download".
      "content-disposition": `inline; filename="${container.code}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
