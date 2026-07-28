import { checkInternalBearer } from "@/lib/internal-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Upsert eines KB24-Admins. Vom Intranet gerufen wenn access
 * `werkstattconnect:<role>` gewährt wurde. Setzt active=true und
 * synct role/name/googleId/imageUrl.
 *
 * Body: { email, role: 'admin'|'agent', name?, googleId?, imageUrl? }
 */
export async function POST(req: Request) {
  const auth = checkInternalBearer(req);
  if (!auth.ok) return new Response("Unauthorized", { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "admin");
  if (!email || !["admin", "agent"].includes(role)) {
    return Response.json({ error: "email + role required" }, { status: 400 });
  }

  const name = body.name ? String(body.name) : null;
  const googleId = body.googleId ? String(body.googleId) : null;
  const imageUrl = body.imageUrl ? String(body.imageUrl) : null;

  const existing = await prisma.kbAdmin.findUnique({ where: { email } });
  if (existing) {
    const updated = await prisma.kbAdmin.update({
      where: { id: existing.id },
      data: {
        role,
        active: true,
        name: name || existing.name,
        googleId: googleId ?? existing.googleId,
        imageUrl: imageUrl ?? existing.imageUrl,
      },
    });
    return Response.json({ ok: true, action: "updated", id: updated.id });
  }

  const created = await prisma.kbAdmin.create({
    data: {
      email,
      role,
      active: true,
      name: name || email.split("@")[0],
      googleId,
      imageUrl,
    },
  });
  return Response.json({ ok: true, action: "created", id: created.id });
}
