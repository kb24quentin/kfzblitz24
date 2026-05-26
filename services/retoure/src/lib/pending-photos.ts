/**
 * PendingPhoto-Lifecycle.
 *
 * Workflow:
 *   1. `savePendingPhoto()` — Shop lädt vor Submit hoch, wir cachen 1h
 *   2. `promoteToItemPhoto()` — Beim Submit promoten wir zu RetoureItemPhoto
 *   3. `cleanupExpiredPendingPhotos()` — Cron räumt nicht-referenzierte weg
 */
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "crypto";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPhotoAbsPath, savePhotoToDisk, extFromMime } from "@/lib/photo-storage";

const PENDING_SUBROOT = "retoure-photos/__pending__";
const TTL_HOURS = 1;

export interface SavePendingPhotoOpts {
  buf: Buffer;
  mimeType: string;
  filename: string;
  kind?: "customer_submitted" | "customer_receipt";
  uploaderIp?: string | null;
  uploaderToken?: string | null;
}

/**
 * Schreibt Photo auf Disk unter __pending__/<photoId>.<ext> und legt
 * eine PendingPhoto-DB-Row an.
 */
export async function savePendingPhoto(opts: SavePendingPhotoOpts): Promise<{
  photoId: string;
  expiresAt: Date;
  size: number;
  mimeType: string;
}> {
  const photoId = "pp_" + randomUUID().replace(/-/g, "").slice(0, 24);
  const ext = extFromMime(opts.mimeType);
  const root = process.env.UPLOAD_DIR?.trim() || "/app/uploads";
  const dir = path.join(root, PENDING_SUBROOT);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${photoId}.${ext}`;
  const abs = path.join(dir, filename);
  await fs.writeFile(abs, opts.buf);
  const relPath = `${PENDING_SUBROOT}/${filename}`;

  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000);

  await prisma.pendingPhoto.create({
    data: {
      id: photoId,
      kind: opts.kind ?? "customer_submitted",
      filename: opts.filename,
      path: relPath,
      mimeType: opts.mimeType,
      sizeBytes: opts.buf.length,
      uploaderIp: opts.uploaderIp ?? null,
      uploaderTokenHash: opts.uploaderToken
        ? createHash("sha256").update(opts.uploaderToken).digest("hex").slice(0, 32)
        : null,
      expiresAt,
    },
  });

  return {
    photoId,
    expiresAt,
    size: opts.buf.length,
    mimeType: opts.mimeType,
  };
}

/**
 * Verschiebt eine PendingPhoto in den finalen Storage-Bereich des
 * Cases/Items und legt eine RetoureItemPhoto-Row an. Löscht danach
 * die PendingPhoto-Row + die Pending-Datei.
 *
 * Wirft wenn die PendingPhoto nicht gefunden wird oder schon expired ist.
 *
 * Wird typischerweise innerhalb einer Prisma-Transaction aufgerufen
 * (Submit-Handler). Der `tx`-Parameter kann eine Transaction oder
 * `prisma` selbst sein.
 */
export async function promoteToItemPhoto(
  tx: PrismaTypes.TransactionClient | typeof prisma,
  photoId: string,
  itemId: string,
  caseId: string,
): Promise<string> {
  const pending = await tx.pendingPhoto.findUnique({ where: { id: photoId } });
  if (!pending) {
    throw new Error(`pending_photo_not_found: ${photoId}`);
  }
  if (pending.expiresAt < new Date()) {
    throw new Error(`pending_photo_expired: ${photoId}`);
  }

  // File auf neuen Pfad verschieben
  const oldAbs = getPhotoAbsPath(pending.path);
  const ext = path.extname(pending.path).slice(1) || "bin";
  const buf = await fs.readFile(oldAbs);
  const newRel = await savePhotoToDisk(caseId, itemId, photoId, buf, ext);

  // RetoureItemPhoto-Row anlegen
  await tx.retoureItemPhoto.create({
    data: {
      itemId,
      caseId,
      kind: pending.kind,
      filename: pending.filename,
      path: newRel,
      mimeType: pending.mimeType,
      sizeBytes: pending.sizeBytes,
    },
  });

  // PendingPhoto-Row löschen
  await tx.pendingPhoto.delete({ where: { id: photoId } });

  // Pending-File löschen (best-effort, nicht in Transaction kritisch)
  try {
    await fs.unlink(oldAbs);
  } catch {
    /* file already gone — ignore */
  }

  // Item-PhotoCount inkrementieren
  await tx.retoureItem.update({
    where: { id: itemId },
    data: { photoCount: { increment: 1 } },
  });

  return newRel;
}

/**
 * Cron-Worker: löscht PendingPhoto-Rows + Files die älter als 1h sind
 * und nie zu einem Item promoted wurden.
 */
export async function cleanupExpiredPendingPhotos(): Promise<{ deleted: number }> {
  const expired = await prisma.pendingPhoto.findMany({
    where: { expiresAt: { lt: new Date() } },
    take: 200,
  });

  let deleted = 0;
  for (const pp of expired) {
    try {
      await fs.unlink(getPhotoAbsPath(pp.path));
    } catch {
      /* ignore — file already gone */
    }
    await prisma.pendingPhoto.delete({ where: { id: pp.id } });
    deleted++;
  }

  return { deleted };
}
