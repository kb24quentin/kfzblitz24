"use client";

import { useEffect, useState, useTransition } from "react";
import {
  X, Phone, CheckCircle2, XCircle, PhoneOff, Voicemail,
  CalendarCheck, ThumbsDown, Ban, RotateCcw, Building2, Mail,
} from "lucide-react";
import { logCall } from "./actions";
import { type CallOutcome, MAX_CALL_RETRIES } from "./calls-shared";

export type CallReminder = {
  id: string;
  dueDate: string;
  retryCount: number;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    position: string | null;
    phone: string | null;
    email: string;
    city: string | null;
    status: string;
  };
  user: { id: string; name: string } | null;
  step: {
    id: string;
    order: number;
    callNote: string | null;
    campaign: { id: string; name: string } | null;
  } | null;
  activities: Array<{
    id: string;
    type: string;
    content: string | null;
    createdAt: string;
    userName: string | null;
  }>;
};

const OUTCOMES: {
  value: CallOutcome;
  label: string;
  hint: string;
  icon: typeof CheckCircle2;
  tone: "success" | "warning" | "danger" | "neutral";
  isRetry: boolean;
}[] = [
  { value: "reached",         label: "Erreicht",         hint: "Gesprochen — fertig",                 icon: CheckCircle2, tone: "success", isRetry: false },
  { value: "appointment",     label: "Termin",           hint: "Termin vereinbart — fertig",          icon: CalendarCheck, tone: "success", isRetry: false },
  { value: "voicemail",       label: "Mailbox",          hint: "Auf Mailbox gesprochen — retry",      icon: Voicemail,    tone: "warning", isRetry: true },
  { value: "not_reached",     label: "Niemand dran",     hint: "Kein AB, kein Aufheben — retry",      icon: PhoneOff,     tone: "warning", isRetry: true },
  { value: "wrong_number",    label: "Falsche Nummer",   hint: "Nummer stimmt nicht — retry",         icon: XCircle,      tone: "warning", isRetry: true },
  { value: "not_interested",  label: "Kein Interesse",   hint: "Absage — fertig",                     icon: ThumbsDown,   tone: "danger",  isRetry: false },
];

const CONTACT_STATUS_OPTIONS = [
  { v: "", label: "— nicht ändern —" },
  { v: "contacted", label: "Kontaktiert" },
  { v: "replied", label: "Geantwortet" },
  { v: "interested", label: "Interessiert" },
  { v: "not_interested", label: "Kein Interesse" },
  { v: "customer", label: "Kunde" },
];

export function CallLogModal({ reminder, onClose }: { reminder: CallReminder; onClose: () => void }) {
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState("");
  const [statusChange, setStatusChange] = useState("");
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pending, onClose]);

  const submit = () => {
    if (!outcome) { setErrorMsg("Bitte ein Ergebnis wählen."); return; }
    setErrorMsg(null);
    startTransition(async () => {
      const res = await logCall({
        reminderId: reminder.id,
        outcome,
        notes,
        newContactStatus: statusChange || null,
      });
      if (res.ok) {
        onClose();
      } else {
        setErrorMsg(res.message);
      }
    });
  };

  const contact = reminder.contact;
  const displayName = `${contact.firstName} ${contact.lastName}`;
  const retryLabel = reminder.retryCount > 0
    ? `Versuch ${reminder.retryCount + 1}/${MAX_CALL_RETRIES}`
    : "Erster Versuch";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-bg-card w-full max-w-3xl max-h-[90vh] rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-secondary/50">
          <div className="flex items-center gap-2 min-w-0">
            <Phone className="w-4 h-4 text-accent shrink-0" />
            <h3 className="font-semibold text-sm text-text truncate">
              Anruf mit {displayName}
            </h3>
            {reminder.retryCount > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                <RotateCcw className="w-2.5 h-2.5" /> {retryLabel}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="p-1 hover:bg-bg-card rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-text-light" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Contact + call button */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-bg-secondary/50 rounded-lg p-4">
              <div className="text-sm">
                <div className="font-semibold text-text text-base">{displayName}</div>
                {contact.company && (
                  <div className="flex items-center gap-1 text-text-light mt-0.5">
                    <Building2 className="w-3 h-3" /> {contact.company}
                    {contact.position && ` · ${contact.position}`}
                  </div>
                )}
                {contact.city && (
                  <div className="text-xs text-text-light mt-0.5">{contact.city}</div>
                )}
                <div className="flex items-center gap-1 text-text-light mt-1.5 text-xs">
                  <Mail className="w-3 h-3" /> {contact.email}
                </div>
              </div>

              {reminder.step?.campaign && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-text-light">
                  Kampagne: <b className="text-text">{reminder.step.campaign.name}</b>{" "}
                  · Schritt {reminder.step.order + 1}
                </div>
              )}
              {reminder.step?.callNote && (
                <div className="mt-2 text-xs italic bg-blue-50 border border-blue-200 rounded p-2 text-blue-900">
                  Notiz zum Schritt: „{reminder.step.callNote}"
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center items-stretch gap-2">
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  className="bg-accent hover:bg-accent-light text-white rounded-lg p-4 text-center transition-colors"
                >
                  <Phone className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-sm font-mono font-semibold break-all">{contact.phone}</div>
                  <div className="text-[11px] opacity-90 mt-1">Anrufen</div>
                </a>
              ) : (
                <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-4 text-center">
                  <Ban className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-xs font-medium">Keine Telefonnummer</div>
                  <div className="text-[10px] mt-1">
                    Bitte am Kontakt hinterlegen und Reminder neu setzen.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent activities */}
          {reminder.activities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-light uppercase tracking-wide mb-2">
                Kontext — letzte Aktivitäten
              </p>
              <div className="max-h-40 overflow-y-auto bg-bg-secondary/40 border border-border rounded-lg p-3 space-y-1.5">
                {reminder.activities.map((a) => (
                  <div key={a.id} className="text-xs flex gap-2">
                    <span className="text-text-light shrink-0 w-20">
                      {new Date(a.createdAt).toLocaleDateString("de-DE", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                      })}
                    </span>
                    <span className="text-text-light shrink-0 w-14">{activityIcon(a.type)}</span>
                    <span className="text-text flex-1">{a.content ?? "(kein Inhalt)"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outcome */}
          <div>
            <p className="text-xs font-semibold text-text-light uppercase tracking-wide mb-2">
              Ergebnis
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {OUTCOMES.map((o) => {
                const on = outcome === o.value;
                const toneClass =
                  on
                    ? o.tone === "success"
                      ? "bg-success/10 border-success text-success"
                      : o.tone === "warning"
                        ? "bg-warning/10 border-warning text-warning"
                        : o.tone === "danger"
                          ? "bg-danger/10 border-danger text-danger"
                          : "bg-accent/10 border-accent text-accent"
                    : "border-border bg-bg-card text-text-light hover:border-accent/40";
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOutcome(o.value)}
                    className={`p-2 rounded-lg border-2 text-left transition-colors ${toneClass}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <o.icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">{o.label}</span>
                    </div>
                    <div className="text-[10px] mt-0.5 opacity-80">{o.hint}</div>
                  </button>
                );
              })}
            </div>
            {outcome && OUTCOMES.find((o) => o.value === outcome)?.isRetry && (
              <p className="text-[11px] text-text-light mt-1.5">
                Reminder wird um +1 Tag verschoben ({reminder.retryCount + 2}/{MAX_CALL_RETRIES}). Nach {MAX_CALL_RETRIES} vergeblichen Versuchen wird er aufgegeben.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-text-light uppercase tracking-wide mb-2">
              Notizen zum Anruf
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Kurz was besprochen wurde, offene Punkte, nächste Schritte…"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
            />
          </div>

          {/* Optional status change */}
          <div>
            <label className="text-xs font-semibold text-text-light uppercase tracking-wide block mb-1.5">
              Kontakt-Status aktualisieren (optional)
            </label>
            <select
              value={statusChange}
              onChange={(e) => setStatusChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {CONTACT_STATUS_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-text-light mt-1">
              Aktueller Status: <b>{contact.status}</b>
            </p>
          </div>

          {errorMsg && (
            <div className="text-sm text-danger bg-red-50 border border-red-200 rounded p-2">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-bg-secondary/50">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="px-3 py-2 text-sm text-text-light hover:text-text transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={pending || !outcome}
            onClick={submit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            {pending ? "Speichere…" : "Loggen & fertig"}
          </button>
        </div>
      </div>
    </div>
  );
}

function activityIcon(type: string): string {
  switch (type) {
    case "email_sent": return "📧 Mail";
    case "call": return "📞 Anruf";
    case "note": return "📝 Notiz";
    case "comment": return "💬 Kommentar";
    case "status_change": return "🔄 Status";
    case "reply_received": return "↩ Antwort";
    case "reminder_created": return "⏰ Reminder";
    case "contact_edited": return "✏ Edit";
    default: return type;
  }
}
