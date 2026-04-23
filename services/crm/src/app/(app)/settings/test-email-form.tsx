"use client";

import { useActionState, useState } from "react";
import { Send, CheckCircle, XCircle } from "lucide-react";
import { sendTestEmail, type TestEmailState } from "./actions";
import { RichTextEditor } from "@/components/rich-text-editor";

const initialState: TestEmailState = { ok: false, message: "" };

const DEFAULT_BODY = `<p>Hallo,</p><p>dies ist eine Test-Email aus dem kfzblitz24 CRM.</p><p>Viele Grüße</p>`;

export function TestEmailForm() {
  const [state, formAction, pending] = useActionState(sendTestEmail, initialState);
  const [body, setBody] = useState(DEFAULT_BODY);

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
        <input type="hidden" name="body" value={body} />

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
          <RichTextEditor
            value={body}
            onChange={setBody}
            minHeight={180}
            placeholder="Email-Text…"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || !body.replace(/<[^>]+>/g, "").trim()}
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
