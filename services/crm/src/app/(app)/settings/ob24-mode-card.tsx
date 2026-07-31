"use client";

import { useEffect, useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, Info, Lock, ShieldAlert, X } from "lucide-react";
import { requestOb24ModeToggle } from "./actions";

export function Ob24ModeCard({
  currentMode,
  updatedAt,
  updatedByEmail,
}: {
  currentMode: "test" | "live";
  updatedAt: Date | null;
  updatedByEmail: string | null;
}) {
  const target: "test" | "live" = currentMode === "live" ? "test" : "live";
  const [showModal, setShowModal] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowModal(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showModal]);

  const initiate = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestOb24ModeToggle();
      if (!res.ok || !res.pendingId) {
        setError(res.message ?? "Konnte Aktion nicht anlegen.");
        return;
      }
      // Landing-URL nach Google-Re-Auth
      const callbackUrl = `/settings/ob24-apply?pending=${encodeURIComponent(res.pendingId)}`;
      // signOut löscht die aktuelle Session; der callbackUrl zeigt auf die
      // App, die dann ohne Session ist → der NextAuth-Middleware/Route-Guard
      // schickt automatisch zu /login. Von dort klickt der User "Mit Google
      // anmelden". So ist ein frischer Sign-In garantiert.
      await signOut({ redirectTo: callbackUrl });
    });
  };

  return (
    <div className="bg-bg-card rounded-xl border border-border p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-text flex items-center gap-2">
            <Lock className="w-4 h-4 text-accent" /> OnlineBrief24 · Modus
          </h3>
          <p className="text-xs text-text-light mt-0.5">
            Bestimmt, ob Briefe wirklich gedruckt und verschickt werden ({" "}
            <b>Live</b>) oder nur im OB24-Warenkorb landen (<b>Test</b>).
          </p>
        </div>
        <ModeBadge mode={currentMode} />
      </div>

      {updatedAt && (
        <p className="text-[11px] text-text-light">
          Zuletzt geändert am {new Date(updatedAt).toLocaleString("de-DE")}
          {updatedByEmail && ` von ${updatedByEmail}`}.
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            target === "live"
              ? "bg-danger text-white hover:bg-red-600"
              : "bg-bg-secondary text-text border border-border hover:bg-border/30"
          }`}
        >
          {target === "live" ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
          Auf {target === "live" ? "LIVE" : "Test"} umschalten
        </button>
      </div>

      {error && (
        <div className="text-xs text-danger bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !pending && setShowModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-card w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-secondary/50">
              <h3 className="font-semibold text-sm text-text flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-danger" />
                OB24-Modus umschalten
              </h3>
              <button
                type="button"
                onClick={() => !pending && setShowModal(false)}
                className="p-1 hover:bg-bg-card rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-text-light" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <p className="text-text">
                Du wechselst OB24 von{" "}
                <b className={currentMode === "live" ? "text-danger" : ""}>{currentMode}</b> auf{" "}
                <b className={target === "live" ? "text-danger" : "text-success"}>{target}</b>.
              </p>

              {target === "live" && (
                <div className="bg-warning/10 border border-warning/40 rounded p-3 text-xs">
                  <p className="font-semibold text-text mb-1">⚠ Achtung — LIVE bedeutet:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-text-light">
                    <li>Jeder Brief-Job wird real gedruckt und per Post verschickt</li>
                    <li>Es fallen echte Kosten bei OB24 an</li>
                    <li>Kein Rückgängig für bereits übermittelte Jobs</li>
                  </ul>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900">
                <p className="font-semibold mb-1">Zur Bestätigung erforderlich:</p>
                <p>
                  Du wirst gleich <b>ausgeloggt</b> und musst dich <b>erneut mit Google anmelden</b>.
                  Erst dann greift die Umschaltung. Zeitfenster: 10 Minuten.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-bg-secondary/50">
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowModal(false)}
                className="px-3 py-2 text-sm text-text-light hover:text-text transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={initiate}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  target === "live"
                    ? "bg-danger text-white hover:bg-red-600"
                    : "bg-accent text-white hover:bg-accent-light"
                }`}
              >
                {pending ? "Öffne Google…" : `Ausloggen & zu Google umleiten`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeBadge({ mode }: { mode: "test" | "live" }) {
  if (mode === "live") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-danger/10 text-danger border border-danger/30">
        <span className="w-2 h-2 bg-danger rounded-full animate-pulse" /> LIVE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300">
      TEST
    </span>
  );
}
