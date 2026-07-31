// Landing-Page nach dem Re-Auth. Verifiziert die PendingAdminAction und
// schaltet den OB24-Modus um. Danach Redirect zu /settings mit Flash.
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// Wie frisch muss der Sign-In sein, damit die Aktion durchgeht.
// (JWT-signedInAt aus src/lib/auth.ts). 5 min Fenster, plus 30s Puffer für
// Redirect-Laufzeit.
const FRESH_SIGNIN_MAX_AGE_SECONDS = 5 * 60;

export default async function Ob24ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  const { pending: pendingId } = await searchParams;
  if (!pendingId) redirect("/settings");

  const result = await applyPendingOb24Toggle(pendingId);
  return <ResultView result={result} />;
}

type ApplyResult =
  | { ok: true; oldMode: "test" | "live"; newMode: "test" | "live" }
  | { ok: false; reason: string };

async function applyPendingOb24Toggle(pendingId: string): Promise<ApplyResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, reason: "Nicht eingeloggt." };

  // Freshness-Check: JWT muss innerhalb der letzten 5 Min neu ausgestellt worden sein.
  const signedInAt = (session.user as { signedInAt?: number }).signedInAt;
  if (!signedInAt) {
    return { ok: false, reason: "Session hat kein Sign-In-Timestamp — bitte neu einloggen." };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - signedInAt > FRESH_SIGNIN_MAX_AGE_SECONDS) {
    return {
      ok: false,
      reason: `Session ist ${Math.round((nowSec - signedInAt) / 60)} Min alt — für diese Aktion ist ein frischer Google-Login erforderlich (max ${FRESH_SIGNIN_MAX_AGE_SECONDS / 60} Min).`,
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

  // Aktuellen Modus lesen (nicht auf payload.fromMode verlassen — DB ist Wahrheit)
  const cfg = await prisma.systemConfig.findUnique({ where: { id: "singleton" } });
  const oldMode = (cfg?.ob24Mode as "test" | "live") ?? "test";

  await prisma.systemConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ob24Mode: newMode, updatedByEmail: session.user.email },
    update: { ob24Mode: newMode, updatedByEmail: session.user.email },
  });

  await prisma.pendingAdminAction.delete({ where: { id: pending.id } }).catch(() => {});

  // Optional: als Activity loggen — allerdings ist Activity contact-gebunden.
  // Konsole reicht für die Audit-Spur.
  console.log(`[ob24] mode ${oldMode} → ${newMode} by ${session.user.email}`);

  return { ok: true, oldMode, newMode };
}

function ResultView({ result }: { result: ApplyResult }) {
  return (
    <div className="max-w-lg mx-auto mt-16 bg-bg-card rounded-xl border border-border p-8 text-center space-y-4">
      {result.ok ? (
        <>
          <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
          <h1 className="text-lg font-semibold text-text">OB24-Modus umgeschaltet</h1>
          <p className="text-sm text-text-light">
            Vorher: <b className={result.oldMode === "live" ? "text-danger" : ""}>{result.oldMode}</b>{" · "}
            Jetzt: <b className={result.newMode === "live" ? "text-danger" : "text-success"}>{result.newMode}</b>
          </p>
          {result.newMode === "live" && (
            <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded p-3">
              ⚠ LIVE-Modus aktiv — ab jetzt werden Briefe an OB24 real gedruckt und versendet.
            </p>
          )}
          {result.newMode === "test" && (
            <p className="text-xs text-text-light">
              Test-Modus aktiv — Briefe landen im OB24-Warenkorb ohne Versand.
            </p>
          )}
        </>
      ) : (
        <>
          <XCircle className="w-12 h-12 text-danger mx-auto" />
          <h1 className="text-lg font-semibold text-text">Umschaltung fehlgeschlagen</h1>
          <p className="text-sm text-text-light">{result.reason}</p>
        </>
      )}
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-light transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Zurück zu den Einstellungen
      </Link>
    </div>
  );
}
