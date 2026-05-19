/**
 * GET /api/admin/pda-devices/:id/qr
 *
 * Liefert den Pairing-QR-Code des Devices als PNG. Auth: NextAuth-
 * Session (admin), kein Bearer.
 *
 * Schreibt direkt den Buffer zurück mit `content-type: image/png`.
 * `cache-control: no-store` weil der Code zeitlich begrenzt gültig ist
 * und sich beim Regenerate-Klick ändert.
 */
import { NextResponse } from "next/server";
import bwipjs from "bwip-js";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildPairingUrl } from "@/lib/pda-devices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const device = await prisma.pdaDevice.findUnique({
    where: { id },
    select: { pairingCode: true, pairingExpiresAt: true, pairedAt: true },
  });

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }
  if (!device.pairingCode || device.pairedAt) {
    return NextResponse.json(
      { error: "Kein aktiver Pairing-Code für dieses Device" },
      { status: 410 },
    );
  }
  if (device.pairingExpiresAt && device.pairingExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "Pairing-Code abgelaufen — bitte neu generieren" },
      { status: 410 },
    );
  }

  // Admin-Host aus dem Request ableiten → PDA-Host wird in der lib
  // durch Voranstellen von `pda.` gebaut. So funktioniert das auf
  // staging und prod ohne env-Var.
  const adminHost = req.headers.get("host") ?? "rma.kfzblitz24-group.com";
  const url = buildPairingUrl(adminHost, device.pairingCode);

  let png: Uint8Array;
  try {
    png = await bwipjs.toBuffer({
      bcid: "qrcode",
      text: url,
      scale: 6, // ~250x250 px für ~40 char URL
      padding: 10,
      backgroundcolor: "FFFFFF",
      eclevel: "M",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: `QR-Generierung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-length": String(png.length),
      "cache-control": "no-store",
    },
  });
}
