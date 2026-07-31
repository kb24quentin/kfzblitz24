// Landing-Page nach dem Re-Auth. Verifiziert die PendingAdminAction,
// schaltet den OB24-Modus um und redirected sofort zurück in die Settings
// mit Query-Params, die dort als Flash-Toast in der OB24-Karte angezeigt
// werden. Der User sieht diese Page nie länger als einen Wimpernschlag.
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const FRESH_SIGNIN_MAX_AGE_SECONDS = 5 * 60;

export default async function Ob24ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  const { pending: pendingId } = await searchParams;
  if (!pendingId) redirect("/settings?tab=config");

  const result = await applyPendingOb24Toggle(pendingId);
  const params = new URLSearchParams({ tab: "config" });
  if (result.ok) {
    params.set("ob24Toggled", "ok");
    params.set("from", result.oldMode);
    params.set("to", result.newMode);
  } else {
    params.set("ob24Toggled", "fail");
    params.set("reason", result.reason);
  }
  redirect(`/settings?${params.toString()}`);
}

type ApplyResult =
  | { ok: true; oldMode: "test" | "live"; newMode: "test" | "live" }
  | { ok: false; reason: string };

async function applyPendingOb24Toggle(pendingId: string): Promise<ApplyResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, reason: "Nicht eingeloggt." };

  const signedInAt = (session.user as { signedInAt?: number }).signedInAt;
  if (!signedInAt) {
    return { ok: false, reason: "Session hat kein Sign-In-Timestamp — bitte neu einloggen." };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - signedInAt > FRESH_SIGNIN_MAX_AGE_SECONDS) {
    return {
      ok: false,
      reason: `Session ist ${Math.round((nowSec - signedInAt) / 60)} Min alt — frischer Google-Login erforderlich (max ${FRESH_SIGNIN_MAX_AGE_SECONDS / 60} Min).`,
    };
  }

  const me = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!me || me.role !== "admin") return { ok: false, reason: "Nur Admins dürfen den OB24-Modus umschalten." };

  const pending = await prisma.pendingAdminAction.findUnique({ where: { id: pendingId } });
  if (!pending) return { ok: false, reason: "Aktion nicht gefunden oder abgelaufen." };
  if (pending.expiresAt < new Date()) {
    await prisma.pendingAdminAction.delete({ where: { id: pending.id } }).catch(() => {});
    return { ok: false, reason: "Aktion abgelaufen (>10 min alt) — bitte neu starten." };
  }
  if (pending.userEmail !== session.user.email) {
    return { ok: false, reason: "Aktion wurde von einem anderen Nutzer initiiert." };
  }
  if (pending.action !== "ob24-mode-toggle") {
    return { ok: false, reason: `Unbekannte Aktion: ${pending.action}` };
  }

  let payload: { newMode?: "test" | "live"; fromMode?: "test" | "live" } = {};
  try { payload = JSON.parse(pending.payload || "{}"); } catch { /* ignore */ }
  const newMode = payload.newMode;
  if (newMode !== "test" && newMode !== "live") {
    return { ok: false, reason: "Payload ungültig." };
  }

  const cfg = await prisma.systemConfig.findUnique({ where: { id: "singleton" } });
  const oldMode = (cfg?.ob24Mode as "test" | "live") ?? "test";

  await prisma.systemConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ob24Mode: newMode, updatedByEmail: session.user.email },
    update: { ob24Mode: newMode, updatedByEmail: session.user.email },
  });

  await prisma.pendingAdminAction.delete({ where: { id: pending.id } }).catch(() => {});
  console.log(`[ob24] mode ${oldMode} → ${newMode} by ${session.user.email}`);

  return { ok: true, oldMode, newMode };
}
