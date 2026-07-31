"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Mail, FileText, Phone, CheckCircle2, Clock, XCircle,
  MessageSquare, StopCircle, Play, Pause, Zap, SkipForward,
} from "lucide-react";
import { stopContactCadence, fireStepNow, skipCurrentStep } from "@/app/(app)/campaigns/actions";

type Cadence = {
  id: string;
  currentStepIndex: number;
  lastStepAt: Date | null;
  stopped: boolean;
  stoppedReason: string | null;
  stoppedAt: Date | null;
  forceFireAt: Date | null;
  campaign: {
    id: string;
    name: string;
    status: string;
    steps: {
      id: string;
      order: number;
      channel: string;
      triggerType: string;
      delayDays: number;
      scheduledAt: Date | null;
      emailTemplateA: { name: string } | null;
      letterTemplateA: { name: string } | null;
      callNote: string | null;
    }[];
  };
  stepProgress: {
    stepId: string;
    executedAt: Date | null;
    status: string;
    step: { id: string; order: number };
  }[];
};

export function ContactCadenceProgress({
  cadences,
  contactId,
}: {
  cadences: Cadence[];
  contactId: string;
}) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-4">
      <h3 className="font-semibold text-sm text-text mb-3">
        Kampagnen-Sequenzen ({cadences.length})
      </h3>
      <div className="space-y-4">
        {cadences.map((c) => (
          <CadenceCard key={c.id} cc={c} contactId={contactId} />
        ))}
      </div>
    </div>
  );
}

function CadenceCard({ cc, contactId }: { cc: Cadence; contactId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const total = cc.campaign.steps.length;
  const current = cc.currentStepIndex;
  const nextStep = current < total ? cc.campaign.steps[current] : null;

  const isActive = !cc.stopped && current < total && cc.campaign.status === "active";
  const isPaused = !cc.stopped && current < total && cc.campaign.status === "paused";
  const isDone = current >= total || cc.stoppedReason === "completed";

  const handleStop = () => {
    startTransition(async () => {
      await stopContactCadence(cc.campaign.id, contactId, "manual");
      setConfirming(false);
    });
  };
  const handleFireNow = () => {
    startTransition(async () => {
      await fireStepNow(cc.campaign.id, contactId);
    });
  };
  const handleSkip = () => {
    if (!confirm(`Aktuellen Schritt für ${cc.campaign.name} überspringen?`)) return;
    startTransition(async () => {
      await skipCurrentStep(cc.campaign.id, contactId);
    });
  };

  const canAct = (isActive || isPaused) && !cc.stopped && nextStep;
  const forceFirePending = cc.forceFireAt !== null;

  return (
    <div className="border border-border rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <Link
          href={`/campaigns/${cc.campaign.id}`}
          className="text-sm font-medium hover:text-accent truncate"
        >
          {cc.campaign.name}
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill cc={cc} isDone={isDone} isActive={isActive} isPaused={isPaused} />
          {canAct && !confirming && (
            <>
              <button
                type="button"
                onClick={handleFireNow}
                disabled={pending || forceFirePending}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={forceFirePending
                  ? "Ist bereits für sofortigen Versand markiert — wartet auf nächsten Cron-Tick (max 1 min)"
                  : "Aktuellen Schritt sofort feuern (ignoriert Wartezeit + Sendefenster)"}
              >
                <Zap className="w-3 h-3" />
                {forceFirePending ? "Wartet auf Cron" : "Jetzt feuern"}
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={pending}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded text-text-light hover:bg-bg-secondary hover:text-text transition-colors"
                title="Aktuellen Schritt überspringen und zum nächsten weitergehen"
              >
                <SkipForward className="w-3 h-3" />
                Skip
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-xs text-text-light hover:text-red-600 transition-colors"
                title="Sequenz für diesen Kontakt manuell stoppen"
              >
                <StopCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {confirming && (
            <>
              <button
                type="button"
                onClick={handleStop}
                disabled={pending}
                className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Stoppen?
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs text-text-light hover:text-text"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      {/* Step timeline */}
      <div className="flex items-center gap-1 mb-2">
        {cc.campaign.steps.map((s, i) => {
          const executed = cc.stepProgress.find((p) => p.stepId === s.id);
          const done = !!executed && executed.status === "executed";
          const skipped = !!executed && executed.status === "skipped";
          const stoppedHere = cc.stopped && i >= current;
          const isCurrent = i === current && !cc.stopped;
          const Icon = s.channel === "email" ? Mail : s.channel === "letter" ? FileText : Phone;

          return (
            <div key={s.id} className="flex items-center gap-1 flex-1 min-w-0">
              <div
                className={`flex items-center justify-center rounded-full w-7 h-7 shrink-0 ${
                  done
                    ? "bg-green-100 text-green-700 border border-green-300"
                    : skipped
                      ? "bg-gray-100 text-gray-400 border border-gray-300"
                      : stoppedHere
                        ? "bg-gray-50 text-gray-400 border border-gray-200"
                        : isCurrent
                          ? "bg-accent text-white border border-accent"
                          : "bg-bg-secondary text-text-light border border-border"
                }`}
                title={`Schritt ${i + 1}: ${s.channel}${done ? " (erledigt)" : skipped ? " (übersprungen)" : ""}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              {i < cc.campaign.steps.length - 1 && (
                <div className={`h-0.5 flex-1 ${done ? "bg-green-300" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Explanatory text */}
      <div className="text-xs text-text-light">
        {isDone ? (
          <>Alle {total} Schritte abgeschlossen{cc.stoppedAt && ` am ${new Date(cc.stoppedAt).toLocaleDateString("de-DE")}`}.</>
        ) : cc.stopped ? (
          <>
            Gestoppt nach Schritt {current} / {total}
            {cc.stoppedReason === "replied" && " — Kontakt hat geantwortet"}
            {cc.stoppedReason === "manual" && " — manuell gestoppt"}
            {cc.stoppedReason === "campaign_ended" && " — Kampagne abgeschlossen"}
            {cc.stoppedReason === "migrated" && " — von altem System migriert"}
            {cc.stoppedAt && ` (${new Date(cc.stoppedAt).toLocaleDateString("de-DE")})`}
          </>
        ) : nextStep ? (
          <>
            Nächster Schritt {current + 1}/{total}:{" "}
            <b>
              {nextStep.channel === "email" ? "E-Mail" : nextStep.channel === "letter" ? "Brief" : "Anruf"}
            </b>
            {" — "}
            {nextStepTiming(nextStep, cc.lastStepAt, current === 0)}
          </>
        ) : (
          <>Alle Schritte erledigt.</>
        )}
      </div>
    </div>
  );
}

function StatusPill({
  cc, isDone, isActive, isPaused,
}: {
  cc: Cadence;
  isDone: boolean;
  isActive: boolean;
  isPaused: boolean;
}) {
  if (isDone) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle2 className="w-3 h-3" /> Fertig
      </span>
    );
  }
  if (cc.stopped) {
    const Icon = cc.stoppedReason === "replied" ? MessageSquare : XCircle;
    const label =
      cc.stoppedReason === "replied" ? "Geantwortet"
      : cc.stoppedReason === "manual" ? "Gestoppt"
      : cc.stoppedReason === "campaign_ended" ? "Kampagne beendet"
      : cc.stoppedReason === "migrated" ? "Migriert"
      : "Gestoppt";
    const color = cc.stoppedReason === "replied" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700";
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3" /> {label}
      </span>
    );
  }
  if (isPaused) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <Pause className="w-3 h-3" /> Kampagne pausiert
      </span>
    );
  }
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <Play className="w-3 h-3" /> Aktiv
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      <Clock className="w-3 h-3" /> Draft
    </span>
  );
}

function nextStepTiming(
  step: { triggerType: string; delayDays: number; scheduledAt: Date | null },
  lastStepAt: Date | null,
  isFirst: boolean,
): string {
  if (step.triggerType === "absolute" && step.scheduledAt) {
    return `am ${new Date(step.scheduledAt).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
    })}`;
  }
  if (step.delayDays === 0) return isFirst ? "sofort bei Kampagnenstart" : "sofort nach letztem Schritt";

  const base = lastStepAt ? new Date(lastStepAt) : new Date();
  const target = new Date(base);
  target.setDate(target.getDate() + step.delayDays);
  return `in ${step.delayDays} Tagen (${target.toLocaleDateString("de-DE")})`;
}
