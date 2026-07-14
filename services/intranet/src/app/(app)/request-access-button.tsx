"use client";

import { useState } from "react";
import { Send, Check, Clock } from "lucide-react";
import type { AppDef } from "@/lib/apps";
import { requestAccessAction } from "./settings/actions";

export function RequestAccessButton({
  app,
  pendingRole,
}: {
  app: AppDef;
  pendingRole: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(app.roles[0]?.key || "user");
  const [msg, setMsg] = useState("");
  const [submitted, setSubmitted] = useState(!!pendingRole);
  const [submitting, setSubmitting] = useState(false);

  if (submitted) {
    const roleLabel =
      app.roles.find((r) => r.key === (pendingRole || role))?.label || role;
    return (
      <div className="mt-3 flex items-center gap-1 text-xs text-warning">
        <Clock className="w-3.5 h-3.5" />
        Anfrage läuft ({roleLabel})
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium"
      >
        <Send className="w-3 h-3" /> Zugriff beantragen
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        setSubmitting(true);
        await requestAccessAction(fd);
        setSubmitting(false);
        setSubmitted(true);
        setOpen(false);
      }}
      className="mt-3 p-3 bg-bg-secondary/60 rounded-lg space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="appKey" value={app.key} />
      <div>
        <label className="block text-xs text-text-light mb-1">Gewünschte Rolle</label>
        <select
          name="requestedRole"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-border rounded bg-white"
        >
          {app.roles.map((r) => (
            <option key={r.key} value={r.key} title={r.description}>
              {r.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-text-light mt-1 italic">
          {app.roles.find((r) => r.key === role)?.description || ""}
        </p>
      </div>
      <div>
        <label className="block text-xs text-text-light mb-1">
          Kurze Begründung (optional)
        </label>
        <textarea
          name="message"
          rows={2}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="z.B. brauche das für Projekt X …"
          className="w-full px-2 py-1.5 text-xs border border-border rounded bg-white resize-y"
        />
      </div>
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-accent text-white rounded text-xs font-medium hover:bg-accent-light disabled:opacity-50"
        >
          <Check className="w-3 h-3" /> {submitting ? "Sende…" : "Anfragen"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 py-1.5 border border-border rounded text-xs text-text-light"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
