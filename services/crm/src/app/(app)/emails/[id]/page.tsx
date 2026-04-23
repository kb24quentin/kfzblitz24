export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  CheckCircle,
  Eye,
  MousePointerClick,
  MessageSquare,
  AlertTriangle,
  Send,
  Clock,
} from "lucide-react";

const statusBadge: Record<string, { label: string; className: string }> = {
  queued: { label: "In Warteschleife", className: "bg-gray-100 text-gray-700" },
  sent: { label: "Versendet", className: "bg-blue-100 text-blue-700" },
  delivered: { label: "Zugestellt", className: "bg-emerald-100 text-emerald-700" },
  opened: { label: "Geöffnet", className: "bg-green-100 text-green-700" },
  replied: { label: "Beantwortet", className: "bg-purple-100 text-purple-700" },
  bounced: { label: "Bounced", className: "bg-red-100 text-red-700" },
  failed: { label: "Fehler", className: "bg-red-100 text-red-700" },
};

function fmt(dt: Date | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const email = await prisma.email.findUnique({
    where: { id },
    include: {
      contact: true,
      campaign: true,
      template: true,
      replies: { orderBy: { receivedAt: "asc" } },
    },
  });

  if (!email) notFound();

  const status = statusBadge[email.status] ?? {
    label: email.status,
    className: "bg-gray-100 text-gray-700",
  };

  const timeline: { icon: typeof Mail; label: string; at: Date | null; color: string }[] = [
    { icon: Send, label: "Versendet", at: email.sentAt, color: "text-blue-600" },
    { icon: CheckCircle, label: "Zugestellt", at: email.status === "delivered" || email.openedAt ? email.sentAt : null, color: "text-emerald-600" },
    { icon: Eye, label: "Geöffnet", at: email.openedAt, color: "text-green-600" },
    { icon: MousePointerClick, label: "Link geklickt", at: email.clickedAt, color: "text-info" },
    { icon: MessageSquare, label: "Geantwortet", at: email.repliedAt, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/contacts/${email.contactId}`}
          className="p-2 hover:bg-bg-card rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-light" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text">{email.subject}</h1>
          <p className="text-sm text-text-light">
            an{" "}
            <Link href={`/contacts/${email.contactId}`} className="text-accent hover:underline">
              {email.contact.firstName} {email.contact.lastName} ({email.contact.email})
            </Link>
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Metadata + Timeline */}
        <div className="space-y-4">
          <div className="bg-bg-card rounded-xl border border-border p-4 space-y-2 text-sm">
            <h3 className="font-semibold text-sm text-text mb-2">Details</h3>
            <Row label="Erstellt" value={fmt(email.createdAt)} />
            {email.campaign ? (
              <Row label="Kampagne" value={email.campaign.name} />
            ) : (
              <Row label="Kampagne" value={<span className="text-text-light italic">Direkt-Mail</span>} />
            )}
            {email.template && <Row label="Template" value={email.template.name} />}
            {email.variant && <Row label="Variante" value={email.variant} />}
            {email.resendEmailId && (
              <Row
                label="Resend ID"
                value={<span className="font-mono text-xs">{email.resendEmailId}</span>}
              />
            )}
          </div>

          <div className="bg-bg-card rounded-xl border border-border p-4">
            <h3 className="font-semibold text-sm text-text mb-3">Verlauf</h3>
            <div className="space-y-2">
              {timeline.map((t) => {
                const Icon = t.icon;
                const happened = !!t.at;
                return (
                  <div
                    key={t.label}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      happened ? "bg-bg-secondary" : "opacity-40"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${happened ? t.color : "text-text-light"}`} />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-text">{t.label}</p>
                      <p className="text-xs text-text-light">{fmt(t.at)}</p>
                    </div>
                  </div>
                );
              })}
              {email.status === "bounced" && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-red-50 text-danger">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-sm font-medium">Mail wurde abgelehnt</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Email Body */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-bg-secondary">
              <p className="text-xs text-text-light">
                <Mail className="w-3 h-3 inline mr-1" />
                Inhalt der versendeten Mail
              </p>
            </div>
            <div className="p-6 prose max-w-none" dangerouslySetInnerHTML={{ __html: email.body }} />
          </div>

          {email.replies.length > 0 && (
            <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-bg-secondary">
                <p className="text-sm font-semibold text-text">
                  Antworten ({email.replies.length})
                </p>
              </div>
              <div className="divide-y divide-border">
                {email.replies.map((r) => (
                  <div key={r.id} className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-text-light">
                      <Clock className="w-3 h-3" />
                      <span>{fmt(r.receivedAt)}</span>
                      <span>·</span>
                      <span className="font-mono">{r.fromEmail}</span>
                    </div>
                    {r.subject && <p className="text-sm font-medium text-text">{r.subject}</p>}
                    <p className="text-sm text-text whitespace-pre-wrap">{r.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-text-light w-20 shrink-0">{label}</span>
      <span className="text-sm text-text">{value}</span>
    </div>
  );
}
