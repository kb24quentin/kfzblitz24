"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Clock, AlertCircle, Building2, User, Calendar, RotateCcw } from "lucide-react";
import { CallLogModal, type CallReminder } from "./call-log-modal";
import { snoozeCall } from "./actions";
import { MAX_CALL_RETRIES } from "./calls-shared";

export function CallsQueue({ reminders }: { reminders: CallReminder[] }) {
  const [active, setActive] = useState<CallReminder | null>(null);

  if (reminders.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl border border-border p-10 text-center">
        <Phone className="w-10 h-10 text-text-light/40 mx-auto mb-3" />
        <p className="text-sm text-text-light">
          Aktuell keine offenen Anrufe. Kadenz-Schritte vom Typ „Anruf" landen hier automatisch.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        {reminders.map((r, i) => (
          <CallRow
            key={r.id}
            r={r}
            first={i === 0}
            onOpen={() => setActive(r)}
            onSnooze={async () => {
              await snoozeCall(r.id, 1);
            }}
          />
        ))}
      </div>

      {active && (
        <CallLogModal
          reminder={active}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}

function CallRow({
  r, first, onOpen, onSnooze,
}: {
  r: CallReminder;
  first: boolean;
  onOpen: () => void;
  onSnooze: () => Promise<void>;
}) {
  const dueDate = new Date(r.dueDate);
  const now = new Date();
  const isOverdue = dueDate < now && dueDate.toDateString() !== now.toDateString();
  const isToday = dueDate.toDateString() === now.toDateString();

  const dueLabel = dueDate.toLocaleDateString("de-DE");
  const dueColor = isOverdue
    ? "text-danger bg-danger/10 border border-danger/30"
    : isToday
      ? "text-accent bg-accent/10 border border-accent/30"
      : "text-text-light bg-bg-secondary border border-border";

  return (
    <div className={`p-4 flex items-start gap-4 ${!first ? "border-t border-border" : ""}`}>
      {/* Contact + company + phone */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/contacts/${r.contact.id}`}
            className="text-sm font-semibold text-text hover:text-accent"
          >
            {r.contact.firstName} {r.contact.lastName}
          </Link>
          {r.contact.company && (
            <span className="text-xs text-text-light flex items-center gap-1">
              <Building2 className="w-3 h-3" /> {r.contact.company}
            </span>
          )}
          {r.contact.city && (
            <span className="text-xs text-text-light">· {r.contact.city}</span>
          )}
          {r.retryCount > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
              <RotateCcw className="w-2.5 h-2.5" /> Versuch {r.retryCount + 1}/{MAX_CALL_RETRIES}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-text-light">
          {r.contact.phone ? (
            <a
              href={`tel:${r.contact.phone}`}
              className="text-accent font-mono font-medium hover:underline"
            >
              <Phone className="w-3 h-3 inline mr-1" />
              {r.contact.phone}
            </a>
          ) : (
            <span className="text-danger">⚠ Keine Telefonnummer</span>
          )}
          {r.step?.campaign && (
            <>
              <span>·</span>
              <span>
                Kampagne{" "}
                <Link href={`/campaigns/${r.step.campaign.id}`} className="hover:text-accent">
                  {r.step.campaign.name}
                </Link>{" "}
                · Schritt {r.step.order + 1}
              </span>
            </>
          )}
          {r.user && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {r.user.name}
              </span>
            </>
          )}
        </div>

        {r.step?.callNote && (
          <p className="text-xs text-text mt-2 bg-bg-secondary/60 rounded p-2 italic">
            „{r.step.callNote}"
          </p>
        )}
      </div>

      {/* Due badge + actions */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${dueColor}`}>
          {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
          {isOverdue ? `Überfällig · ${dueLabel}` : isToday ? `Heute` : dueLabel}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSnooze()}
            className="text-xs px-2 py-1 rounded border border-border text-text-light hover:bg-bg-secondary hover:text-text transition-colors flex items-center gap-1"
            title="Um 1 Tag verschieben (ohne Log)"
          >
            <Clock className="w-3 h-3" /> +1 Tag
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-light transition-colors font-medium flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5" /> Anrufen & loggen
          </button>
        </div>
      </div>
    </div>
  );
}
