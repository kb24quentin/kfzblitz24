export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { CheckCircle, XCircle, Key, Mail, Globe, Users } from "lucide-react";
import { UserManagement } from "./user-management";
import { TestEmailForm } from "./test-email-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab || "config";

  const hasResendKey = !!process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "nicht konfiguriert";
  const maskedKey = hasResendKey
    ? process.env.RESEND_API_KEY!.slice(0, 6) + "..." + process.env.RESEND_API_KEY!.slice(-4)
    : "";

  const users = tab === "users"
    ? await prisma.user.findMany({ orderBy: { createdAt: "asc" } })
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-bg-card rounded-xl border border-border p-1">
        <a
          href="/settings?tab=config"
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "config" ? "bg-primary text-white" : "text-text-light hover:text-text hover:bg-bg-secondary"
          }`}
        >
          <Key className="w-4 h-4" /> API & Konfiguration
        </a>
        <a
          href="/settings?tab=users"
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "users" ? "bg-primary text-white" : "text-text-light hover:text-text hover:bg-bg-secondary"
          }`}
        >
          <Users className="w-4 h-4" /> Benutzer
        </a>
      </div>

      {tab === "config" ? (
        <>
          {hasResendKey ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="text-sm font-semibold text-green-800">Live-Modus aktiv</span>
              </div>
              <p className="text-sm text-green-700 mt-1">Resend ist verbunden. Emails werden tatsaechlich versendet.</p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-warning" />
                <span className="text-sm font-semibold text-yellow-800">Demo-Modus</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">Kein Resend API Key. Emails werden nur simuliert.</p>
            </div>
          )}

          <div className="bg-bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`${hasResendKey ? "bg-success/10" : "bg-accent/10"} w-10 h-10 rounded-lg flex items-center justify-center`}>
                <Key className={`w-5 h-5 ${hasResendKey ? "text-success" : "text-accent"}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text">Resend API</h3>
              </div>
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${hasResendKey ? "text-success bg-success/10" : "text-warning bg-warning/10"}`}>
                {hasResendKey ? <><CheckCircle className="w-3.5 h-3.5" /> Verbunden</> : <><XCircle className="w-3.5 h-3.5" /> Nicht verbunden</>}
              </span>
            </div>
            <div className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary font-mono">
              {hasResendKey ? maskedKey : "— nicht gesetzt —"}
            </div>
          </div>

          <div className="bg-bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center"><Mail className="w-5 h-5 text-primary" /></div>
              <h3 className="font-semibold text-text">Absender</h3>
            </div>
            <div className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary">{fromEmail}</div>
          </div>

          <div className="bg-bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-info/10 w-10 h-10 rounded-lg flex items-center justify-center"><Globe className="w-5 h-5 text-info" /></div>
              <div><h3 className="font-semibold text-text">Webhook</h3><p className="text-xs text-text-light">Email-Tracking</p></div>
            </div>
            <div className="p-3 bg-bg-secondary rounded-lg font-mono text-xs">POST https://crm.kfzblitz24-group.com/api/webhook/resend</div>
          </div>

          <TestEmailForm />
        </>
      ) : (
        <UserManagement users={users} />
      )}
    </div>
  );
}
