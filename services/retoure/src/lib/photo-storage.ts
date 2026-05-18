/**
 * Foto-Storage auf Disk.
 *
 * Layout unter UPLOAD_DIR (default `/app/uploads`, gemountet auf
 * `/opt/kfzblitz24/data/<env>/retoure-photos` via docker-compose):
 *
 *   retoure-photos/<caseId>/<itemId>/<photoId>.<ext>
 *
 * Wir speichern bewusst keine Originale auf S3 o.ä. — die Mengen sind
 * überschaubar (5–6 Fotos pro Item × paar hundert Items/Monat) und das
 * Volume auf dem VPS reicht problemlos. Backup: rsync via VPS-Snapshot.
 *
 * Alle Pfade nach außen sind **relativ** zu UPLOAD_DIR (`retoure-photos/...`).
 * Erst der `getPhotoAbsPath()`-Helper resolved sie auf den absoluten
 * Filesystem-Pfad. So bleibt der DB-Eintrag portabel, falls wir das Root
 * mal verschieben.
 */
import fs from "node:fs/promises";
import path from "node:path";

const SUBROOT = "retoure-photos";

function getUploadRoot(): string {
  const root = process.env.UPLOAD_DIR?.trim() || "/app/uploads";
  return root;
}

/**
 * Schreibt `buf` als `<photoId>.<ext>` unter
 *   <UPLOAD_DIR>/retoure-photos/<caseId>/<itemId>/
 * und gibt den **relativen** Pfad (ab UPLOAD_DIR) zurück, der in die
 * DB geschrieben werden sollte.
 */
export async function savePhotoToDisk(
  caseId: string,
  itemId: string,
  photoId: string,
  buf: Buffer,
  ext: string
): Promise<string> {
  const cleanExt = ext.replace(/^\.+/, "").toLowerCase() || "bin";
  const root = getUploadRoot();
  const dir = path.join(root, SUBROOT, sanitize(caseId), sanitize(itemId));
  await fs.mkdir(dir, { recursive: true });
  const filename = `${sanitize(photoId)}.${cleanExt}`;
  const abs = path.join(dir, filename);
  await fs.writeFile(abs, buf);
  // Relativer Pfad ab UPLOAD_DIR (forward-slashes für DB-Portabilität)
  return [SUBROOT, sanitize(caseId), sanitize(itemId), filename].join("/");
}

/**
 * Resolved den DB-Pfad (`retoure-photos/<case>/<item>/<photo>.<ext>`)
 * auf den absoluten Filesystem-Pfad unter UPLOAD_DIR.
 *
 * Wirft, wenn der resolved Path außerhalb des Roots läge (Path-Traversal-
 * Guard); das sollte bei sauberen DB-Einträgen nicht vorkommen.
 */
export function getPhotoAbsPath(rel: string): string {
  const root = getUploadRoot();
  const abs = path.resolve(root, rel);
  const rootAbs = path.resolve(root) + path.sep;
  if (!abs.startsWith(rootAbs) && abs !== path.resolve(root)) {
    throw new Error(`Path traversal blocked: ${rel}`);
  }
  return abs;
}

/**
 * Best-effort Delete einer Foto-Datei. Schlägt nicht hart fehl, wenn
 * die Datei schon weg ist (z.B. weil das Volume neu gemountet wurde).
 */
export async function deletePhoto(rel: string): Promise<void> {
  try {
    const abs = getPhotoAbsPath(rel);
    await fs.unlink(abs);
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return; // schon weg
    throw e;
  }
}

/**
 * Liefert das Mime-Type-passende File-Extension. Akzeptiert PNG/JPEG/HEIC,
 * defaultet sonst auf `bin`.
 */
export function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/heic" || m === "image/heif") return "heic";
  if (m === "image/webp") return "webp";
  return "bin";
}

function sanitize(s: string): string {
  // cuids enthalten nur [a-z0-9]; alles andere weg, falls jemand was
  // anderes als ID-Argument reinreicht.
  return s.replace(/[^a-zA-Z0-9_-]/g, "");
}
