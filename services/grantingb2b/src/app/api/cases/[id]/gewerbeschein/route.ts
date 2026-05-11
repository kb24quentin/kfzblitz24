import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { uploadAbsolutePath } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const c = await prisma.b2BCase.findUnique({
    where: { id },
    select: {
      gewerbescheinPath: true,
      gewerbescheinFilename: true,
      gewerbescheinMimeType: true,
    },
  });
  if (!c || !c.gewerbescheinPath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const buf = await readFile(uploadAbsolutePath(c.gewerbescheinPath));
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": c.gewerbescheinMimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${c.gewerbescheinFilename ?? "gewerbeschein"}"`,
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
