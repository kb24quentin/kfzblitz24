import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { uploadAbsolutePath } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  const doc = await prisma.b2BCaseDocument.findUnique({
    where: { id: docId },
    select: { caseId: true, path: true, filename: true, mimeType: true },
  });
  if (!doc || doc.caseId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const buf = await readFile(uploadAbsolutePath(doc.path));
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${doc.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Datei nicht lesbar: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
