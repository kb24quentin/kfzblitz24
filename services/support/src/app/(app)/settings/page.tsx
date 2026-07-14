import { prisma } from "@/lib/db";
import { Settings, CheckCircle2, XCircle } from "lucide-react";
import { isGmailConfigured } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [users, cursor] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.gmailCursor.findFirst({ where: { id: "singleton" } }),
  ]);
  const gmailOk = isGmailConfigured();
  const openAiOk = !!process.env.OPENAI_API_KEY;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-text flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5" /> Einstellungen
      </h1>

      <div className="bg-bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-text mb-3">Integrationen</h2>
        <div className="space-y-2 text-sm">
          <StatusRow
            label="Gmail (Inbound)"
            detail={
              cursor?.lastPolledAt
                ? `Zuletzt gepollt: ${cursor.lastPolledAt.toLocaleString("de-DE")}`
                : "Noch nie gepollt"
            }
            ok={gmailOk}
          />
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
        {(!gmailOk || !openAiOk) && (
          <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg text-xs text-text">
            Fehlende ENV-Variablen auf VPS ergänzen:{" "}
            <span className="font-mono">
              /opt/kfzblitz24/services/support/.env.staging
            </span>
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
        <p className="text-xs text-text-light mt-3">
          Weitere Team-Mitglieder werden aktuell direkt in der Datenbank per Seed
          angelegt. Ein User-Management-UI folgt.
        </p>
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
