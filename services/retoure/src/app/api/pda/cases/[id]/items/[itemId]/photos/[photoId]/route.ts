/**
 * DELETE /api/pda/cases/:id/items/:itemId/photos/:photoId
 *
 * Entfernt die DB-Row und (best-effort) die Datei vom Disk.
 * Dekrementiert RetoureItem.photoCount.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { addEvent } from "@/lib/retoure-cases";
import { deletePhoto } from "@/lib/photo-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
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

  // Erst Row löschen — wenn das fehlschlägt, behalten wir die Datei
  await prisma.$transaction([
    prisma.retoureItemPhoto.delete({ where: { id: photoId } }),
    prisma.retoureItem.update({
      where: { id: itemId },
      data: { photoCount: { decrement: 1 } },
    }),
  ]);

  // File-Cleanup ist best-effort: wenn das Volume gerade nicht verfügbar
  // ist, soll die DB-Konsistenz erhalten bleiben.
  try {
    if (photo.path) await deletePhoto(photo.path);
  } catch (e) {
    console.warn(
      `[photos DELETE] file cleanup failed for ${photo.path}: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  await addEvent(
    id,
    "item_photo_deleted",
    `Foto (${photo.kind}) gelöscht`,
    { itemId, photoId, kind: photo.kind },
    "pda"
  );

  return NextResponse.json({ ok: true });
}
