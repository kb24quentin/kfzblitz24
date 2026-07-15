import Link from "next/link";
import { prisma } from "@/lib/db";
import { Settings, CheckCircle2, XCircle, Link2, Unlink, FileText, ArrowRight, Clock, Users } from "lucide-react";
import { isGmailConfigured, getGmailUserEmail, hasOAuthApp, getRedirectUri } from "@/lib/gmail";
import { auth } from "@/lib/auth";
import { SignatureEditor } from "./signature-editor";
import { AutoAckEditor } from "./auto-ack-editor";
import { AiAutopilotSection } from "./ai-autopilot";
import { AiCostsSection } from "./ai-costs";
import { CategoriesManager } from "./categories-manager";
import { BusinessHoursEditor } from "./business-hours";
import { fieldsForUser } from "@/lib/signature";
import {
  getSlaFirstResponseHours,
  getSlaResolutionHours,
  getAutoAckEnabled,
  getAutoAckSubject,
  getAutoAckBody,
  getAutoSendCategories,
  getAutoSendMinConfidence,
  getTicketCategories,
  getBusinessHours,
} from "@/lib/settings";
import { saveSlaSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; detail?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const currentUser = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { signature: true },
      })
    : null;

  const [
    users,
    cursor,
    gmailOk,
    gmailUserEmail,
    templateCount,
    slaFirst,
    slaRes,
    ackEnabled,
    ackSubject,
    ackBody,
    autoSendCats,
    autoSendMinConf,
    ticketCategories,
    businessHours,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "asc" }, { name: "asc" }] }),
    prisma.gmailCursor.findFirst({ where: { id: "singleton" } }),
    isGmailConfigured(),
    getGmailUserEmail(),
    prisma.template.count(),
    getSlaFirstResponseHours(),
    getSlaResolutionHours(),
    getAutoAckEnabled(),
    getAutoAckSubject(),
    getAutoAckBody(),
    getAutoSendCategories(),
    getAutoSendMinConfidence(),
    getTicketCategories(),
    getBusinessHours(),
  ]);
  const openAiOk = !!process.env.OPENAI_API_KEY;
  const oauthAppReady = hasOAuthApp();
  const redirectUri = getRedirectUri();

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-text flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5" /> Einstellungen
      </h1>

      {params.gmail === "ok" && (
        <FlashBanner ok>
          Gmail verbunden als{" "}
          <span className="font-mono">{decodeURIComponent(params.detail || "")}</span>
        </FlashBanner>
      )}
      {params.gmail === "error" && (
        <FlashBanner ok={false}>
          Gmail-Verbindung fehlgeschlagen: {decodeURIComponent(params.detail || "unknown")}
        </FlashBanner>
      )}
      {params.gmail === "disconnected" && (
        <FlashBanner ok>Gmail-Verbindung getrennt.</FlashBanner>
      )}

      <SectionHeader title="Integrationen" />

      <div className="bg-bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-text mb-3">Integrationen</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border/60">
            <div>
              <div className="font-medium text-text">Gmail (Inbound)</div>
              <div className="text-xs text-text-light">
                {gmailOk && gmailUserEmail
                  ? `Verbunden als ${gmailUserEmail}`
                  : oauthAppReady
                    ? "OAuth-App vorhanden, aber noch nicht verbunden"
                    : "OAuth-Client-ID/Secret fehlen im ENV"}
                {cursor?.lastPolledAt && gmailOk && (
                  <> · zuletzt gepollt: {cursor.lastPolledAt.toLocaleString("de-DE")}</>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {gmailOk ? (
                <>
                  <span className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="w-4 h-4" /> Verbunden
                  </span>
                  <form action="/api/gmail/disconnect" method="post">
                    <button
                      type="submit"
                      className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs text-text-light hover:bg-bg-secondary transition-colors"
                    >
                      <Unlink className="w-3 h-3" /> Trennen
                    </button>
                  </form>
                </>
              ) : oauthAppReady ? (
                <a
                  href="/api/gmail/connect"
                  className="flex items-center gap-1 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
                >
                  <Link2 className="w-4 h-4" /> Gmail verbinden
                </a>
              ) : (
                <span className="flex items-center gap-1 text-xs text-warning">
                  <XCircle className="w-4 h-4" /> Nicht konfiguriert
                </span>
              )}
            </div>
          </div>

          <StatusRow
            label="Resend (Outbound)"
            detail={process.env.FROM_EMAIL || "—"}
            ok={!!process.env.RESEND_API_KEY}
          />

          <StatusRow
            label="OpenAI (AI-Drafts)"
            detail={process.env.OPENAI_MODEL || "gpt-4o"}
            ok={openAiOk}
          />
        </div>

        {oauthAppReady && !gmailOk && (
          <div className="mt-4 p-3 bg-info/10 border border-info/30 rounded-lg text-xs text-text">
            Vor dem Klick auf &quot;Gmail verbinden&quot;: In Google Cloud Console →
            Credentials → OAuth 2.0 Client → als autorisierte Redirect-URI
            eintragen:
            <div className="mt-1 font-mono bg-white/60 px-2 py-1 rounded break-all">
              {redirectUri}
            </div>
          </div>
        )}
      </div>

      <SectionHeader title="Automatisierung" />

      <div className="mb-6">
        <AutoAckEditor enabled={ackEnabled} subject={ackSubject} body={ackBody} />
      </div>

      <div className="mb-6">
        <AiAutopilotSection
          categories={ticketCategories}
          allowedCategories={Array.from(autoSendCats)}
          minConfidence={autoSendMinConf}
        />
      </div>

      {currentUser?.role === "admin" && (
        <>
          <SectionHeader title="AI · Kosten & Nutzung" />
          <AiCostsSection />
        </>
      )}

      <div className="mb-6">
        <CategoriesManager initial={ticketCategories} />
      </div>

      <SectionHeader title="Zeiten & SLAs" />

      <div className="bg-bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-text flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-accent" /> SLAs
        </h2>
        <p className="text-xs text-text-light mb-4">
          Wird auf neu erstellte Tickets angewendet. Bestehende Tickets behalten
          ihre alten Deadlines.
        </p>
        <form action={saveSlaSettingsAction} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Erstantwort (Stunden)
            </label>
            <input
              type="number"
              name="firstResponseHours"
              min={1}
              max={720}
              defaultValue={slaFirst}
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <p className="text-xs text-text-light mt-1">Standard: 24 h</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Lösung (Stunden)
            </label>
            <input
              type="number"
              name="resolutionHours"
              min={1}
              max={2160}
              defaultValue={slaRes}
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <p className="text-xs text-text-light mt-1">Standard: 72 h</p>
          </div>
          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
            >
              SLAs speichern
            </button>
          </div>
        </form>
      </div>

      <div className="mb-6">
        <BusinessHoursEditor initial={businessHours} />
      </div>

      <SectionHeader title="Persönlich & Vorlagen" />

      {currentUser && (
        <div className="mb-6">
          <SignatureEditor
            signature={
              currentUser.signature
                ? {
                    displayName: currentUser.signature.displayName,
                    position: currentUser.signature.position,
                    email: currentUser.signature.email,
                    updatedAt: currentUser.signature.updatedAt,
                  }
                : null
            }
            defaults={fieldsForUser(
              {
                name: currentUser.name,
                email: currentUser.email,
                role: currentUser.role,
              },
              null,
            )}
          />
        </div>
      )}

      <Link
        href="/templates"
        className="mb-6 flex items-center justify-between bg-bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-text">Antwort-Templates</h2>
            <p className="text-xs text-text-light">
              {templateCount} Templates · Variablen wie{" "}
              <span className="font-mono">{"{{customer.first_name}}"}</span> werden im
              Composer eingesetzt
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-text-light group-hover:text-accent transition-colors" />
      </Link>

      <SectionHeader title="Team & Zugriff" />

      <a
        href="https://kfzblitz24-group.com/settings"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between bg-bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-text">
              Team-Verwaltung im Intranet
            </h2>
            <p className="text-xs text-text-light mt-0.5">
              User anlegen, aktivieren, Support-Rolle zuweisen — zentral im
              Intranet. Änderungen wirken sofort im Support.
              {" "}
              {users.filter((u) => !u.active).length > 0 && (
                <span className="text-warning font-medium">
                  · Aktuell {users.filter((u) => !u.active).length} pending
                </span>
              )}
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-text-light group-hover:text-accent transition-colors" />
      </a>
    </div>
  );
}

function StatusRow({ label, detail, ok }: { label: string; detail: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <div className="font-medium text-text">{label}</div>
        <div className="text-xs text-text-light">{detail}</div>
      </div>
      {ok ? (
        <span className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="w-4 h-4" /> Konfiguriert
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-warning">
          <XCircle className="w-4 h-4" /> Nicht konfiguriert
        </span>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-light mt-8 mb-3 pl-1">
      {title}
    </h3>
  );
}

function FlashBanner({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`mb-4 p-3 rounded-lg text-sm ${
        ok
          ? "bg-success/10 border border-success/30 text-success"
          : "bg-danger/10 border border-danger/30 text-danger"
      }`}
    >
      {children}
    </div>
  );
}
