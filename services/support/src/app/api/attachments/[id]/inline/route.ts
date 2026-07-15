import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Serves an attachment's raw bytes for INLINE rendering (no Content-Disposition
 * attachment). Used by <img src="/api/attachments/<id>/inline"> in the ticket
 * thread — replaces the original cid: refs in inbound HTML mails.
 * Session-auth: same auth as the rest of the app.
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
  return new NextResponse(att.content, {
    status: 200,
    headers: {
      "Content-Type": att.contentType || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
