/**
 * POST /api/retoure/photos/upload
 *
 * Customer-Photo-Upload VOR Case-Submit (Native-in-Shop-Flow).
 *
 * Auth: Bearer (Shop-API-Token).
 *
 * Body: multipart/form-data
 *   file: File (max 10 MB, image/jpeg|png|heic|webp)
 *   kind: "customer_submitted" | "customer_receipt"  (default: customer_submitted)
 *
 * Response: { photoId, expiresAt, size, mimeType }
 *
 * Lifecycle: Photo wird 1h in __pending__/ zwischengespeichert. Shop muss
 * die `photoId` beim nachfolgenden `/api/retoure/submit` in `items[].photo_ids`
 * referenzieren — sonst wird sie nach 1h vom Cleanup-Cron gelöscht.
 */
import { NextResponse } from "next/server";
import { checkBearer, getBearerToken } from "@/lib/api-auth";
import { savePendingPhoto } from "@/lib/pending-photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
]);

export async function POST(req: Request) {
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
    return NextResponse.json(
      { error: "file_too_large", maxSize: MAX_SIZE_BYTES },
      { status: 413 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIMES.has(mimeType.toLowerCase())) {
    return NextResponse.json(
      { error: "unsupported_mime", allowed: Array.from(ALLOWED_MIMES) },
      { status: 415 },
    );
  }

  const kindParam = (formData.get("kind") ?? "customer_submitted") as string;
  const kind: "customer_submitted" | "customer_receipt" =
    kindParam === "customer_receipt" ? "customer_receipt" : "customer_submitted";

  const buf = Buffer.from(await file.arrayBuffer());

  const uploaderIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const result = await savePendingPhoto({
    buf,
    mimeType,
    filename: file.name || "upload.bin",
    kind,
    uploaderIp,
    uploaderToken: getBearerToken(req),
  });

  return NextResponse.json({
    photoId: result.photoId,
    expiresAt: result.expiresAt.toISOString(),
    size: result.size,
    mimeType: result.mimeType,
  });
}
