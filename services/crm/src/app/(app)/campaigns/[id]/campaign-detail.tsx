"use client";

import { useState } from "react";
import { Play, Pause, Send, Mail, MailOpen, MessageSquare, AlertTriangle } from "lucide-react";
import { updateCampaignStatus, sendCampaignEmails } from "../actions";

type Props = {
  campaign: {
    id: string;
    name: string;
    status: string;
    abSplitRatio: number;
    sendRatePerDay: number;
    followUpEnabled: boolean;
    followUpDelayDays: number;
    templateA: { name: string };
    templateB: { name: string } | null;
  };
  emails: Array<{
    id: string;
    subject: string;
    status: string;
    variant: string | null;
    sentAt: Date | null;
    openedAt: Date | null;
    repliedAt: Date | null;
    contact: { firstName: string; lastName: string; email: string };
  }>;
  stats: { sent: number; opened: number; replied: number; bounced: number; queued: number; total: number };
  abStats: {
    a: { sent: number; opened: number; replied: number };
    b: { sent: number; opened: number; replied: number };
  } | null;
};

export function CampaignDetail({ campaign, emails, stats, abStats }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      await sendCampaignEmails(campaign.id);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    await updateCampaignStatus(campaign.id, status);
  };

  const openRate = (sent: number, opened: number) =>
    sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0";
  const replyRate = (sent: number, replied: number) =>
    sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">{campaign.name}</h2>
          <p className="text-sm text-text-light mt-1">
            Template: {campaign.templateA.name}
            {campaign.templateB && ` / ${campaign.templateB.name}`}
            {campaign.followUpEnabled && ` · Follow-Up nach ${campaign.followUpDelayDays} Tagen`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <button
              onClick={handleSend}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {loading ? "Wird vorbereitet..." : "Emails senden"}
            </button>
          )}
          {campaign.status === "active" && (
            <button
              onClick={() => handleStatusChange("paused")}
              className="flex items-center gap-2 px-4 py-2 bg-warning text-white rounded-lg text-sm font-medium hover:bg-yellow-500 transition-colors"
            >
              <Pause className="w-4 h-4" /> Pausieren
            </button>
          )}
          {campaign.status === "paused" && (
            <button
              onClick={() => handleStatusChange("active")}
              className="flex items-center gap-2 px-4 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              <Play className="w-4 h-4" /> Fortsetzen
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Gesamt", value: stats.total, icon: Mail, color: "text-text" },
          { label: "Gesendet", value: stats.sent, icon: Send, color: "text-accent" },
          { label: "Geöffnet", value: `${openRate(stats.sent, stats.opened)}%`, icon: MailOpen, color: "text-success" },
          { label: "Antworten", value: `${replyRate(stats.sent, stats.replied)}%`, icon: MessageSquare, color: "text-primary" },
          { label: "Bounced", value: stats.bounced, icon: AlertTriangle, color: "text-danger" },
        ].map((s) => (
          <div key={s.label} className="bg-bg-card rounded-xl border border-border p-4 text-center">
            <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
            <p className="text-xl font-bold text-text">{s.value}</p>
            <p className="text-xs text-text-light">{s.label}</p>
          </div>
        ))}
      </div>

      {/* A/B Test Results */}
      {abStats && (
        <div className="bg-bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-text mb-4">A/B Test Ergebnisse</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: `Template A: ${campaign.templateA.name}`, data: abStats.a, split: campaign.abSplitRatio },
              { label: `Template B: ${campaign.templateB?.name}`, data: abStats.b, split: 100 - campaign.abSplitRatio },
            ].map((variant) => (
              <div key={variant.label} className="p-4 bg-bg-secondary rounded-lg">
                <p className="font-medium text-sm mb-2">{variant.label} ({variant.split}%)</p>
                <div className="space-y-1 text-sm">
                  <p>Gesendet: <span className="font-medium">{variant.data.sent}</span></p>
                  <p>Open Rate: <span className="font-medium">{openRate(variant.data.sent, variant.data.opened)}%</span></p>
                  <p>Reply Rate: <span className="font-medium">{replyRate(variant.data.sent, variant.data.replied)}%</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email List */}
      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-text">Emails ({emails.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-secondary">
              <th className="text-left p-3 font-medium text-text-light">Kontakt</th>
              <th className="text-left p-3 font-medium text-text-light">Betreff</th>
              <th className="text-left p-3 font-medium text-text-light">Variante</th>
              <th className="text-left p-3 font-medium text-text-light">Status</th>
              <th className="text-left p-3 font-medium text-text-light">Gesendet</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.id} className="border-b border-border last:border-0 hover:bg-bg-secondary/50">
                <td className="p-3 font-medium">
                  {email.contact.firstName} {email.contact.lastName}
                  <p className="text-xs text-text-light">{email.contact.email}</p>
                </td>
                <td className="p-3 text-text-light truncate max-w-[200px]">{email.subject}</td>
                <td className="p-3">
                  {email.variant && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      email.variant === "A" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {email.variant}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    email.status === "sent" ? "bg-green-100 text-green-700"
                    : email.status === "opened" ? "bg-blue-100 text-blue-700"
                    : email.status === "bounced" ? "bg-red-100 text-red-700"
                    : email.status === "queued" ? "bg-gray-100 text-gray-700"
                    : "bg-gray-100 text-gray-700"
                  }`}>
                    {email.status}
                  </span>
                </td>
                <td className="p-3 text-text-light text-xs">
                  {email.sentAt ? new Date(email.sentAt).toLocaleDateString("de-DE") : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
