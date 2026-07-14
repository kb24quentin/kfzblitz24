import { prisma } from "@/lib/db";
import { Settings, CheckCircle2, XCircle, Link2, Unlink } from "lucide-react";
import { isGmailConfigured, getGmailUserEmail, hasOAuthApp, getRedirectUri } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; detail?: string }>;
}) {
  const params = await searchParams;
  const [users, cursor, gmailOk, gmailUserEmail] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.gmailCursor.findFirst({ where: { id: "singleton" } }),
    isGmailConfigured(),
    getGmailUserEmail(),
  ]);
  const openAiOk = !!process.env.OPENAI_API_KEY;
  const oauthAppReady = hasOAuthApp();
  const redirectUri = getRedirectUri();

  return (
    <div className="max-w-3xl">
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

      <div className="bg-bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold text-text mb-3">Team ({users.length})</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-text-light border-b border-border">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Email</th>
              <th className="py-2 font-medium">Rolle</th>
              <th className="py-2 font-medium">Aktiv</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2 text-text">{u.name}</td>
                <td className="py-2 text-text-light">{u.email}</td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      u.role === "admin"
                        ? "bg-accent/15 text-accent"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-2">
                  {u.active ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-danger" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
