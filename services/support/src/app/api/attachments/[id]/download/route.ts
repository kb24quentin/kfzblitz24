import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Serves an attachment as a downloadable file (Content-Disposition: attachment).
 * Used by the "download"-button on the attachment chip in a ticket message.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const att = await prisma.attachment.findUnique({
    where: { id },
    select: { filename: true, contentType: true, content: true },
  });
  if (!att || !att.content) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const safe = att.filename.replace(/["\\]/g, "").slice(0, 200) || "attachment";
  return new NextResponse(att.content, {
    status: 200,
    headers: {
      "Content-Type": att.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
