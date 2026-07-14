import { checkInternalBearer } from "@/lib/internal-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Upsert a support user. Called by the intranet when an admin grants
 * `support:<role>` access to a workspace user. Sets active=true and syncs
 * role/name/imageUrl/googleId. On first call, creates the user.
 *
 * Body: {
 *   email: string (required),
 *   role: 'admin' | 'agent' (required),
 *   name?: string,
 *   googleId?: string | null,
 *   imageUrl?: string | null,
 * }
 */
export async function POST(req: Request) {
  const auth = checkInternalBearer(req);
  if (!auth.ok) return new Response("Unauthorized", { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "agent");
  if (!email || !["admin", "agent"].includes(role)) {
    return Response.json({ error: "email + role required" }, { status: 400 });
  }

  const name = body.name ? String(body.name) : null;
  const googleId = body.googleId ? String(body.googleId) : null;
  const imageUrl = body.imageUrl ? String(body.imageUrl) : null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const updated = await prisma.user.update({
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

  const created = await prisma.user.create({
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
