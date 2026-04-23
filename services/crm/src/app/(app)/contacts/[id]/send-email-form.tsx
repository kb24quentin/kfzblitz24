"use client";

import { useActionState, useState } from "react";
import { Send, CheckCircle, XCircle, Mail } from "lucide-react";
import { sendDirectEmail, type SendDirectEmailResult } from "./actions";

const initial: SendDirectEmailResult = { ok: false, message: "" };

export function SendEmailForm({
  contactId,
  contactEmail,
  contactName,
}: {
  contactId: string;
  contactEmail: string;
  contactName: string;
}) {
  const [state, formAction, pending] = useActionState(sendDirectEmail, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
      >
        <Mail className="w-4 h-4" /> Mail an Kontakt schreiben
      </button>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-text">Mail an {contactName}</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-text-light hover:text-text"
        >
          Abbrechen
        </button>
      </div>

      <form action={formAction} className="space-y-3" key={state.ok ? "sent" : "draft"}>
        <input type="hidden" name="contactId" value={contactId} />

        <div>
          <label className="text-xs font-medium text-text-light mb-1 block">An</label>
          <div className="px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary font-mono">
            {contactEmail}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-text-light mb-1 block">Betreff</label>
          <input
            type="text"
            name="subject"
            required
            placeholder="Betreff der Mail"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-light mb-1 block">Inhalt</label>
          <textarea
            name="body"
            required
            rows={8}
            placeholder={`Hallo ${contactName.split(" ")[0]},\n\n…`}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" /> {pending ? "Sende…" : "Senden"}
          </button>
          <span className="text-xs text-text-light">Wird im Verlauf protokolliert.</span>
        </div>

        {state.message && (
          <div
            className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              state.ok
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {state.ok ? (
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span>{state.message}</span>
          </div>
        )}
      </form>
    </div>
  );
}
