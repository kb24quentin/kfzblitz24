import { auth } from "./auth";

export async function requireKbAdmin() {
  const session = await auth();
  const audience = (session?.user as { audience?: string } | undefined)?.audience;
  if (audience !== "kb_admin") {
    throw new Error("Nicht autorisiert (KB24-Admin erforderlich)");
  }
  return session!;
}

export async function requireWorkshopUser() {
  const session = await auth();
  const u = session?.user as
    | { audience?: string; workshopId?: string | null; role?: string | null; id?: string }
    | undefined;
  if (u?.audience !== "workshop" || !u?.workshopId) {
    throw new Error("Nicht autorisiert (Werkstatt-Login erforderlich)");
  }
  return {
    session: session!,
    userId: u.id!,
    workshopId: u.workshopId,
    role: u.role ?? "mitarbeiter",
  };
}

export async function requireWorkshopAdmin() {
  const ctx = await requireWorkshopUser();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new Error("Nicht autorisiert (Werkstatt-Admin erforderlich)");
  }
  return ctx;
}
