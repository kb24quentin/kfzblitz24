"use client";

import { useActionState } from "react";
import { Send, CheckCircle, XCircle } from "lucide-react";
import { sendTestEmail, type TestEmailState } from "./actions";

const initialState: TestEmailState = { ok: false, message: "" };

export function TestEmailForm() {
  const [state, formAction, pending] = useActionState(sendTestEmail, initialState);

  return (
    <div className="bg-bg-card rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center">
          <Send className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-text">Test-Email senden</h3>
          <p className="text-xs text-text-light">
            Sendet via Resend an die angegebene Adresse — verifiziert die Konfiguration.
          </p>
        </div>
      </div>

      <form action={formAction} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-text-light mb-1 block">Empfänger</label>
          <input
            type="email"
            name="to"
            required
            placeholder="empfaenger@example.com"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-light mb-1 block">Betreff</label>
          <input
            type="text"
            name="subject"
            required
            defaultValue="Test-Email aus dem CRM"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-light mb-1 block">Inhalt</label>
          <textarea
            name="body"
            required
            rows={6}
            defaultValue={"Hallo,\n\ndies ist eine Test-Email aus dem kfzblitz24 CRM.\n\nViele Grüße"}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary font-mono"
          />
          <p className="text-xs text-text-light mt-1">
            Plain text — Zeilenumbrüche werden im HTML-Teil als &lt;br&gt; übernommen.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {pending ? "Sende…" : "Test-Email senden"}
          </button>
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
            <span className="break-all">{state.message}</span>
          </div>
        )}
      </form>
    </div>
  );
}
