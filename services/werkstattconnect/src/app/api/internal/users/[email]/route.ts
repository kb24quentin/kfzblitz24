import { checkInternalBearer } from "@/lib/internal-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Soft-deactivate eines KB24-Admins (setzt active=false). Gerufen wenn
 * intranet den WerkstattConnect-access entzieht.
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

  const existing = await prisma.kbAdmin.findUnique({ where: { email } });
  if (!existing) return Response.json({ ok: true, action: "noop" });

  await prisma.kbAdmin.update({ where: { id: existing.id }, data: { active: false } });
  return Response.json({ ok: true, action: "deactivated" });
}
