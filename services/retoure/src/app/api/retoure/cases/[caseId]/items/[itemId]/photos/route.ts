/**
 * POST /api/retoure/cases/{caseId}/items/{itemId}/photos
 *
 * Nachträglicher Photo-Upload zu einem bereits angelegten Item.
 * Wird verwendet wenn der Customer NACH dem Submit noch Photos
 * nachreichen will (z. B. via Service-Anfrage).
 *
 * Bevorzugt: Photos VOR dem Submit via `/photos/upload` hochladen +
 * `photo_ids` im Submit-Payload referenzieren — sauberer Flow.
 *
 * Auth: Bearer (Shop-API-Token).
 *
 * Body: multipart/form-data
 *   file: File (max 10 MB, image/*)
 *   kind: "customer_submitted" | "customer_receipt"  (default: customer_submitted)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkBearer } from "@/lib/api-auth";
import { savePhotoToDisk, extFromMime } from "@/lib/photo-storage";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string; itemId: string }> },
) {
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

  const { caseId, itemId } = await params;

  // Validate item belongs to case
  const item = await prisma.retoureItem.findFirst({
    where: { id: itemId, caseId },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json(
      { error: "item_not_found_in_case" },
      { status: 404 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_missing" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIMES.has(mimeType.toLowerCase())) {
    return NextResponse.json({ error: "unsupported_mime" }, { status: 415 });
  }

  const kindParam = (formData.get("kind") ?? "customer_submitted") as string;
  const kind: string =
    kindParam === "customer_receipt" ? "customer_receipt" : "customer_submitted";

  const buf = Buffer.from(await file.arrayBuffer());
  const photoId = "ph_" + randomUUID().replace(/-/g, "").slice(0, 24);
  const ext = extFromMime(mimeType);

  const relPath = await savePhotoToDisk(caseId, itemId, photoId, buf, ext);

  const photo = await prisma.retoureItemPhoto.create({
    data: {
      itemId,
      caseId,
      kind,
      filename: file.name || `${photoId}.${ext}`,
      path: relPath,
      mimeType,
      sizeBytes: buf.length,
    },
  });

  await prisma.retoureItem.update({
    where: { id: itemId },
    data: { photoCount: { increment: 1 } },
  });

  return NextResponse.json({
    photoId: photo.id,
    kind: photo.kind,
    size: photo.sizeBytes,
    mimeType: photo.mimeType,
    createdAt: photo.createdAt.toISOString(),
  });
}
