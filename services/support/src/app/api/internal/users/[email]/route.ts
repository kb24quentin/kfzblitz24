import { checkInternalBearer } from "@/lib/internal-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Soft-deactivate a support user (sets active=false). We don't hard-delete
 * because the User row is referenced by Message.authorUserId, TicketNote.userId,
 * Ticket.assigneeId etc. Called when intranet revokes `support` access.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const auth = checkInternalBearer(req);
  if (!auth.ok) return new Response("Unauthorized", { status: auth.status });

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail).toLowerCase();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) return Response.json({ ok: true, action: "noop" });

  await prisma.user.update({ where: { id: existing.id }, data: { active: false } });
  return Response.json({ ok: true, action: "deactivated" });
}
