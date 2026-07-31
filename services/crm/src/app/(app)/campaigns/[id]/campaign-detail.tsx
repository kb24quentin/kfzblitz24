"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play, Pause, Send, Mail, MailOpen, MessageSquare, AlertTriangle, MousePointerClick,
  FileText, Phone, CheckCircle2, Clock, XCircle, StopCircle, Flag,
} from "lucide-react";
import { updateCampaignStatus, sendCampaignEmails, completeCampaign } from "../actions";

type Step = {
  id: string;
  order: number;
  channel: string;
  triggerType: string;
  delayDays: number;
  scheduledAt: Date | null;
  sendWindow: string | null;
  maxPerDay: number | null;
  emailTemplateA: { name: string } | null;
  emailTemplateB: { name: string } | null;
  letterTemplateA: { name: string } | null;
  letterTemplateB: { name: string } | null;
  letterColor: string | null;
  callNote: string | null;
};

type ContactProgress = {
  ccId: string;
  contact: { id: string; firstName: string; lastName: string; email: string };
  currentStepIndex: number;
  lastStepAt: Date | null;
  stopped: boolean;
  stoppedReason: string | null;
  stoppedAt: Date | null;
};

type Props = {
  campaign: {
    id: string;
    name: string;
    status: string;
    sendRatePerDay: number;
    scheduledAt: Date | null;
    steps: Step[];
  };
  contacts: ContactProgress[];
  stats: {
    total: number;
    active: number;
    completed: number;
    stopped: number;
    replied: number;
    perStep: { stepId: string; executed: number }[];
  };
  emails: Array<{
    id: string;
    subject: string;
    status: string;
    variant: string | null;
    sentAt: Date | null;
    openedAt: Date | null;
    clickedAt: Date | null;
    repliedAt: Date | null;
    contact: { firstName: string; lastName: string; email: string };
  }>;
  letters: Array<{
    id: string;
    subject: string;
    status: string;
    sentAt: Date | null;
    ob24JobId: number | null;
    contact: { firstName: string; lastName: string };
  }>;
};

export function CampaignDetail({ campaign, contacts, stats, emails, letters }: Props) {
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">{campaign.name}</h2>
          <p className="text-sm text-text-light mt-1">
            {campaign.steps.length} Schritt{campaign.steps.length === 1 ? "" : "e"}
            {" · "}Status: <span className="font-medium">{campaign.status}</span>
            {campaign.scheduledAt && (
              <> · Startet {new Date(campaign.scheduledAt).toLocaleString("de-DE")}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <button
              onClick={handleStart}
              disabled={loading || campaign.steps.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {loading ? "Wird gestartet..." : "Kampagne starten"}
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
          {(campaign.status === "active" || campaign.status === "paused") && (
            <button
              onClick={async () => {
                if (!confirm(
                  `„${campaign.name}" wirklich abschließen?\n\nAlle noch laufenden Kontakt-Sequenzen werden gestoppt. Weitere Mails/Briefe/Anrufe werden nicht mehr ausgeführt.`
                )) return;
                await completeCampaign(campaign.id);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border text-text rounded-lg text-sm font-medium hover:bg-border/30 transition-colors"
              title="Kampagne vorzeitig als abgeschlossen markieren"
            >
              <Flag className="w-4 h-4" /> Abschließen
            </button>
          )}
          {campaign.status === "completed" && (
            <span className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success border border-success/30 rounded-lg text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> Abgeschlossen
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Gesamt-Kontakte" value={stats.total} icon={Mail} color="text-text" />
        <StatCard label="Aktiv" value={stats.active} icon={Play} color="text-accent" />
        <StatCard label="Fertig" value={stats.completed} icon={CheckCircle2} color="text-success" />
        <StatCard label="Gestoppt" value={stats.stopped} icon={StopCircle} color="text-warning" />
        <StatCard label="Antworten" value={stats.replied} icon={MessageSquare} color="text-primary" />
      </div>

      {/* Cadence timeline */}
      <div className="bg-bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-text mb-4">Kadenz</h3>
        {campaign.steps.length === 0 ? (
          <p className="text-sm text-text-light">Diese Kampagne hat noch keine Schritte.</p>
        ) : (
          <div className="space-y-2">
            {campaign.steps.map((step, i) => {
              const perStep = stats.perStep.find((p) => p.stepId === step.id);
              return (
                <StepRow
                  key={step.id}
                  step={step}
                  index={i}
                  executed={perStep?.executed ?? 0}
                  totalContacts={stats.total}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Contact progress table */}
      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-text">Fortschritt pro Kontakt ({contacts.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary">
                <th className="text-left p-3 font-medium text-text-light">Kontakt</th>
                <th className="text-left p-3 font-medium text-text-light">Fortschritt</th>
                <th className="text-left p-3 font-medium text-text-light">Status</th>
                <th className="text-left p-3 font-medium text-text-light">Letzter Schritt</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((cc) => (
                <tr key={cc.ccId} className="border-b border-border last:border-0 hover:bg-bg-secondary/50">
                  <td className="p-3">
                    <Link href={`/contacts/${cc.contact.id}`} className="font-medium hover:text-accent">
                      {cc.contact.firstName} {cc.contact.lastName}
                    </Link>
                    <p className="text-xs text-text-light">{cc.contact.email}</p>
                  </td>
                  <td className="p-3">
                    <ProgressBar
                      current={cc.currentStepIndex}
                      total={campaign.steps.length}
                      stopped={cc.stopped}
                    />
                  </td>
                  <td className="p-3">
                    <StatusBadge cc={cc} totalSteps={campaign.steps.length} />
                  </td>
                  <td className="p-3 text-text-light text-xs">
                    {cc.lastStepAt
                      ? new Date(cc.lastStepAt).toLocaleString("de-DE", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email + Letter tables (existing behaviour, condensed) */}
      {emails.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-text">E-Mails ({emails.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="text-left p-3 font-medium text-text-light">Kontakt</th>
                  <th className="text-left p-3 font-medium text-text-light">Betreff</th>
                  <th className="text-left p-3 font-medium text-text-light">Var</th>
                  <th className="text-left p-3 font-medium text-text-light">Status</th>
                  <th className="text-center p-3 font-medium text-text-light"><MailOpen className="w-3.5 h-3.5 inline" /></th>
                  <th className="text-center p-3 font-medium text-text-light"><MousePointerClick className="w-3.5 h-3.5 inline" /></th>
                  <th className="text-left p-3 font-medium text-text-light">Gesendet</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => (
                  <tr key={email.id} className="border-b border-border last:border-0 hover:bg-bg-secondary/50">
                    <td className="p-3 font-medium">
                      <Link href={`/emails/${email.id}`}>{email.contact.firstName} {email.contact.lastName}</Link>
                    </td>
                    <td className="p-3 text-text-light truncate max-w-[220px]">{email.subject}</td>
                    <td className="p-3">
                      {email.variant && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          email.variant === "A" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        }`}>{email.variant}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        email.status === "sent" || email.status === "delivered" ? "bg-green-100 text-green-700"
                        : email.status === "opened" ? "bg-blue-100 text-blue-700"
                        : email.status === "replied" ? "bg-purple-100 text-purple-700"
                        : email.status === "bounced" ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                      }`}>{email.status}</span>
                    </td>
                    <td className="p-3 text-center text-xs text-text-light">{email.openedAt ? "✓" : "–"}</td>
                    <td className="p-3 text-center text-xs text-text-light">{email.clickedAt ? "✓" : "–"}</td>
                    <td className="p-3 text-text-light text-xs">
                      {email.sentAt ? new Date(email.sentAt).toLocaleString("de-DE", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" }) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {letters.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-text">Briefe ({letters.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="text-left p-3 font-medium text-text-light">Kontakt</th>
                  <th className="text-left p-3 font-medium text-text-light">Betreff</th>
                  <th className="text-left p-3 font-medium text-text-light">Status</th>
                  <th className="text-left p-3 font-medium text-text-light">OB24 Job</th>
                  <th className="text-left p-3 font-medium text-text-light">Gesendet</th>
                </tr>
              </thead>
              <tbody>
                {letters.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium">{l.contact.firstName} {l.contact.lastName}</td>
                    <td className="p-3 text-text-light truncate max-w-[220px]">{l.subject}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        l.status === "sent" || l.status === "done" ? "bg-green-100 text-green-700"
                        : l.status === "failed" ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                      }`}>{l.status}</span>
                    </td>
                    <td className="p-3 text-text-light text-xs">{l.ob24JobId ?? "–"}</td>
                    <td className="p-3 text-text-light text-xs">
                      {l.sentAt ? new Date(l.sentAt).toLocaleString("de-DE", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" }) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Mail; color: string }) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-4 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
      <p className="text-xl font-bold text-text">{value}</p>
      <p className="text-xs text-text-light">{label}</p>
    </div>
  );
}

function StepRow({ step, index, executed, totalContacts }: {
  step: Step; index: number; executed: number; totalContacts: number;
}) {
  const Icon = step.channel === "email" ? Mail : step.channel === "letter" ? FileText : Phone;
  const label = step.channel === "email" ? "E-Mail" : step.channel === "letter" ? "Brief" : "Anruf";

  const triggerLabel = step.triggerType === "absolute" && step.scheduledAt
    ? `Feste Zeit: ${new Date(step.scheduledAt).toLocaleString("de-DE")}`
    : step.delayDays === 0
      ? (index === 0 ? "Sofort bei Start" : "Sofort nach vorherigem")
      : `+${step.delayDays} Tag${step.delayDays === 1 ? "" : "e"} nach ${index === 0 ? "Start" : "vorherigem"}`;

  const templateLabel = step.channel === "email"
    ? [step.emailTemplateA?.name, step.emailTemplateB?.name].filter(Boolean).join(" / ")
    : step.channel === "letter"
      ? [step.letterTemplateA?.name, step.letterTemplateB?.name].filter(Boolean).join(" / ")
      : (step.callNote ? step.callNote.slice(0, 60) : "Wiedervorlage");

  const pct = totalContacts > 0 ? Math.round((executed / totalContacts) * 100) : 0;

  return (
    <div className="flex items-center gap-3 p-3 bg-bg-secondary/40 rounded-lg">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-white text-xs font-bold shrink-0">
        {index + 1}
      </div>
      <Icon className="w-4 h-4 text-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{label}</span>
          <span className="text-text-light text-xs">· {triggerLabel}</span>
        </div>
        <p className="text-xs text-text-light truncate">
          {templateLabel || <span className="italic">(kein Template)</span>}
          {step.channel === "letter" && step.letterColor && (
            <> · {step.letterColor === "4" ? "Farbig" : "S/W"}</>
          )}
          {step.maxPerDay && <> · max {step.maxPerDay}/Tag</>}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-text">{executed}/{totalContacts}</p>
        <p className="text-xs text-text-light">{pct}%</p>
      </div>
    </div>
  );
}

function ProgressBar({ current, total, stopped }: { current: number; total: number; stopped: boolean }) {
  const dots = Array.from({ length: total });
  return (
    <div className="flex items-center gap-1">
      {dots.map((_, i) => (
        <div
          key={i}
          className={`w-6 h-2 rounded-full ${
            stopped && i >= current
              ? "bg-gray-200"
              : i < current
                ? "bg-accent"
                : "bg-gray-200"
          }`}
          title={`Schritt ${i + 1}${i < current ? " (erledigt)" : ""}`}
        />
      ))}
      <span className="text-xs text-text-light ml-2">
        {current}/{total}
      </span>
    </div>
  );
}

function StatusBadge({ cc, totalSteps }: { cc: ContactProgress; totalSteps: number }) {
  if (cc.stopped) {
    const label =
      cc.stoppedReason === "replied" ? "Geantwortet — gestoppt"
      : cc.stoppedReason === "completed" ? "Alle Schritte durch"
      : cc.stoppedReason === "manual" ? "Manuell gestoppt"
      : cc.stoppedReason === "migrated" ? "Migriert (alt)"
      : "Gestoppt";
    const color =
      cc.stoppedReason === "replied" ? "bg-purple-100 text-purple-700"
      : cc.stoppedReason === "completed" ? "bg-green-100 text-green-700"
      : "bg-gray-100 text-gray-700";
    const Icon =
      cc.stoppedReason === "replied" ? MessageSquare
      : cc.stoppedReason === "completed" ? CheckCircle2
      : XCircle;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3" /> {label}
      </span>
    );
  }
  if (cc.currentStepIndex >= totalSteps) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle2 className="w-3 h-3" /> Fertig
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      <Clock className="w-3 h-3" /> Schritt {cc.currentStepIndex + 1}/{totalSteps}
    </span>
  );
}

// Prevent unused-import warning if tree-shaken
void AlertTriangle;
