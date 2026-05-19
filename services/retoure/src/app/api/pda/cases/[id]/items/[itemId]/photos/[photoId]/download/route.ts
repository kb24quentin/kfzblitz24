/**
 * GET /api/pda/cases/:id/items/:itemId/photos/:photoId/download
 *
 * Liefert die rohe Foto-Datei als binär-Response mit korrektem
 * Content-Type. Bearer-Auth wie der Rest der PDA-API.
 */
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { getPhotoAbsPath } from "@/lib/photo-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; itemId: string; photoId: string }> }
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
  const { id, itemId, photoId } = await params;

  const photo = await prisma.retoureItemPhoto.findUnique({
    where: { id: photoId },
  });
  if (!photo || photo.itemId !== itemId || photo.caseId !== id) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  if (!photo.path) {
    return NextResponse.json(
      { error: "Photo path not set (upload incomplete)" },
      { status: 410 }
    );
  }

  let abs: string;
  try {
    abs = getPhotoAbsPath(photo.path);
  } catch {
    return NextResponse.json({ error: "Invalid photo path" }, { status: 500 });
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(abs);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "File missing on disk" }, { status: 410 });
    }
    return NextResponse.json(
      {
        error: `Read failed: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 }
    );
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": photo.mimeType,
      "content-length": String(buf.length),
      "content-disposition": `inline; filename="${encodeURIComponent(photo.filename)}"`,
      "cache-control": "private, max-age=0, no-store",
    },
  });
}
