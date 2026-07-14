"use client";

import { useState } from "react";
import { MailCheck, Eye, Code2, Check } from "lucide-react";
import { saveAutoAckSettingsAction } from "./actions";

export function AutoAckEditor({
  enabled,
  subject,
  body,
}: {
  enabled: boolean;
  subject: string;
  body: string;
}) {
  const [bodyValue, setBodyValue] = useState(body);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <form
      action={saveAutoAckSettingsAction}
      className="bg-bg-card rounded-xl border border-border p-6 space-y-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-text flex items-center gap-2">
            <MailCheck className="w-4 h-4 text-accent" /> Eingangsbestätigung
          </h2>
          <p className="text-xs text-text-light mt-0.5">
            Automatische Antwort an den Kunden bei jedem neuen Ticket (nicht bei
            Folge-Mails auf bestehende Threads). Zählt NICHT als Erstantwort in
            der SLA-Statistik.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={enabled}
            className="w-4 h-4 accent-accent"
          />
          <span className="font-medium text-text">
            {enabled ? "Aktiv" : "Deaktiviert"}
          </span>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-light mb-1">Betreff</label>
        <input
          name="subject"
          defaultValue={subject}
          required
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-text-light">Text (HTML)</label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            {showPreview ? (
              <>
                <Code2 className="w-3 h-3" /> Code zeigen
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" /> Vorschau
              </>
            )}
          </button>
        </div>
        {showPreview ? (
          <div
            className="min-h-[180px] p-4 border border-border rounded-lg bg-white text-sm"
            dangerouslySetInnerHTML={{ __html: bodyValue }}
          />
        ) : (
          <textarea
            name="body"
            value={bodyValue}
            onChange={(e) => setBodyValue(e.target.value)}
            required
            spellCheck={false}
            className="w-full px-3 py-2 border border-border rounded-lg text-xs font-mono bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
            style={{ minHeight: 200 }}
          />
        )}
        {showPreview && <input type="hidden" name="body" value={bodyValue} />}
        <p className="text-xs text-text-light mt-1">
          Verfügbare Variablen:{" "}
          <span className="font-mono">
            {"{{customer.first_name}}"}, {"{{customer.last_name}}"},{" "}
            {"{{customer.email}}"}, {"{{customer.phone}}"},{" "}
            {"{{ticket.number}}"}, {"{{ticket.subject}}"},{" "}
            {"{{sla.first_response_hours}}"}
          </span>
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Speichern
        </button>
      </div>
    </form>
  );
}
