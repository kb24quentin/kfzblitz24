import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomBytes } from "node:crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/app/uploads";
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export type StoredUpload = {
  path: string; // relative to UPLOAD_DIR root, e.g. "abc123/gewerbeschein.pdf"
  filename: string; // sanitized original filename
  mimeType: string;
  sizeBytes: number;
};

export class UploadError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

/**
 * Save an uploaded file (Gewerbeschein etc.) under a case-specific
 * subdirectory. Files are deduplicated only by storage path (collision-safe
 * via random subfolder prefix), not by content.
 */
export async function saveUpload(file: File, caseId: string): Promise<StoredUpload> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new UploadError(
      `Dateityp nicht erlaubt (${file.type}). Erlaubt: PDF, JPG, PNG.`
    );
  }
  if (file.size <= 0) {
    throw new UploadError("Datei ist leer.");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError(
      `Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`
    );
  }

  const safeBase = sanitizeFilename(file.name || `upload${extname(file.name) || ""}`);
  const folder = `${caseId}_${randomBytes(4).toString("hex")}`;
  const absDir = join(UPLOAD_DIR, folder);
  await mkdir(absDir, { recursive: true });
  const absPath = join(absDir, safeBase);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absPath, buffer);

  return {
    path: `${folder}/${safeBase}`,
    filename: safeBase,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export function uploadAbsolutePath(relPath: string): string {
  return join(UPLOAD_DIR, relPath);
}
