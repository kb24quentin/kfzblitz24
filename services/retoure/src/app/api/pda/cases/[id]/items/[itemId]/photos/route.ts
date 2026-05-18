/**
 * POST   /api/pda/cases/:id/items/:itemId/photos   — multipart upload
 * GET    /api/pda/cases/:id/items/:itemId/photos   — list
 *
 * Upload-Felder:
 *   - file:  PNG / JPEG / HEIC, max 8 MB
 *   - kind:  "ovp" | "artikel" | "detail1" | "detail2" | "other"
 *   - pdaId: optional, fließt nur ins Timeline-Event ein
 *
 * Flow:
 *   1. Multipart parsen, MIME/size validieren
 *   2. RetoureItemPhoto-Row anlegen (Pfad noch nicht final)
 *   3. File auf Disk schreiben unter retoure-photos/<case>/<item>/<id>.<ext>
 *   4. Path zurückschreiben + photoCount auf RetoureItem inkrementieren
 *   5. via Next-`after()` einen OpenAI-Vision-Score im Background triggern;
 *      Ergebnis landet in `aiAnalysisJson`.
 *
 * Wir geben **synchron** zurück sobald die Disk-Schreibphase durch ist —
 * der AI-Score läuft asynchron weiter (kann mehrere Sekunden dauern, das
 * blockt das PDA nicht).
 */
import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { addEvent } from "@/lib/retoure-cases";
import {
  savePhotoToDisk,
  getPhotoAbsPath,
  extFromMime,
} from "@/lib/photo-storage";
import { scorePhoto, AI_PHOTO_MODEL } from "@/lib/ai-photo-score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/heic",
  "image/heif",
]);
const ALLOWED_KIND = new Set(["ovp", "artikel", "detail1", "detail2", "other"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status }
    );
  }
  const { id, itemId } = await params;

  // Item + Parent-Case prüfen
  const item = await prisma.retoureItem.findUnique({ where: { id: itemId } });
  if (!item || item.caseId !== id) {
    return NextResponse.json(
      { error: "Item not found in case" },
      { status: 404 }
    );
  }

  // Multipart parsen
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      {
        error: `Invalid multipart: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const kindRaw = form.get("kind");
  const pdaId = form.get("pdaId");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file fehlt (multipart field)" },
      { status: 400 }
    );
  }
  const kind = typeof kindRaw === "string" ? kindRaw.toLowerCase() : "";
  if (!ALLOWED_KIND.has(kind)) {
    return NextResponse.json(
      {
        error: `kind muss eines von ${[...ALLOWED_KIND].join(", ")} sein`,
      },
      { status: 400 }
    );
  }
  const mimeType = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      {
        error: `Mime-Type ${mimeType || "(leer)"} nicht erlaubt (png/jpeg/heic)`,
      },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Datei zu groß (${file.size} > ${MAX_BYTES} Bytes)`,
      },
      { status: 413 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extFromMime(mimeType);

  // Photo-Row mit temporärem Path anlegen (Pfad braucht photoId)
  const photo = await prisma.retoureItemPhoto.create({
    data: {
      itemId,
      caseId: id,
      kind,
      filename: file.name || `${kind}.${ext}`,
      path: "", // wird gleich gesetzt
      mimeType,
      sizeBytes: buf.length,
    },
  });

  let relPath: string;
  try {
    relPath = await savePhotoToDisk(id, itemId, photo.id, buf, ext);
  } catch (e) {
    // Rollback: Row löschen wenn Disk-Write fehlschlägt
    await prisma.retoureItemPhoto.delete({ where: { id: photo.id } }).catch(() => {});
    return NextResponse.json(
      {
        error: `Disk-Write fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 }
    );
  }

  // Path zurückschreiben + photoCount inkrementieren
  await prisma.$transaction([
    prisma.retoureItemPhoto.update({
      where: { id: photo.id },
      data: { path: relPath },
    }),
    prisma.retoureItem.update({
      where: { id: itemId },
      data: { photoCount: { increment: 1 } },
    }),
  ]);

  await addEvent(
    id,
    "item_photo_uploaded",
    `Foto (${kind}) für Artikel ${item.artikelnummer ?? "(ohne Nr)"} hochgeladen`,
    { itemId, photoId: photo.id, kind, mimeType, sizeBytes: buf.length },
    typeof pdaId === "string" && pdaId ? `pda:${pdaId}` : "pda"
  );

  // AI-Score im Background
  const apiKeyPresent = !!process.env.OPENAI_API_KEY?.trim();
  if (apiKeyPresent) {
    after(async () => {
      try {
        const abs = getPhotoAbsPath(relPath);
        const res = await scorePhoto(abs, mimeType, {
          beschreibung: item.beschreibung ?? undefined,
          grund: item.grund ?? undefined,
        });
        if (res.ok) {
          const ai = {
            score: res.score,
            reasoning: res.reasoning,
            confidence: res.confidence,
            model: AI_PHOTO_MODEL,
            runAt: new Date().toISOString(),
          };
          await prisma.retoureItemPhoto.update({
            where: { id: photo.id },
            data: { aiAnalysisJson: JSON.stringify(ai) },
          });
          await addEvent(
            id,
            "item_photo_scored",
            `AI-Score Foto (${kind}): ${res.score}/100 conf=${res.confidence.toFixed(2)}`,
            { itemId, photoId: photo.id, ...ai },
            "system"
          );
        } else {
          await addEvent(
            id,
            "item_photo_score_failed",
            `AI-Score fehlgeschlagen: ${res.error}`,
            { itemId, photoId: photo.id, skipped: res.skipped === true },
            "system"
          );
        }
      } catch (e) {
        console.error("[photos] after() ai-score crashed:", e);
      }
    });
  }

  return NextResponse.json({
    ok: true,
    photo: {
      id: photo.id,
      kind: photo.kind,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
    },
    scheduledAiScore: apiKeyPresent,
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status }
    );
  }
  const { id, itemId } = await params;

  const item = await prisma.retoureItem.findUnique({ where: { id: itemId } });
  if (!item || item.caseId !== id) {
    return NextResponse.json(
      { error: "Item not found in case" },
      { status: 404 }
    );
  }

  const photos = await prisma.retoureItemPhoto.findMany({
    where: { itemId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ok: true,
    photos: photos.map((p) => ({
      id: p.id,
      kind: p.kind,
      filename: p.filename,
      mimeType: p.mimeType,
      sizeBytes: p.sizeBytes,
      createdAt: p.createdAt.toISOString(),
      ai: p.aiAnalysisJson ? safeJson(p.aiAnalysisJson) : null,
    })),
  });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
