"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { previewTicketDeleteAction, hardDeleteTicketAction } from "./actions";

type Preview = {
  id: string;
  code: string;
  subject: string;
  customerEmail: string;
  status: string;
  messages: number;
  notes: number;
  drafts: number;
  attachments: number;
  orders: number;
};

export function AdminDeleteSection() {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadPreview = () => {
    setError(null);
    setSuccess(null);
    setPreview(null);
    if (!code.trim()) return;
    startTransition(async () => {
      const result = await previewTicketDeleteAction(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result.ticket);
    });
  };

  const doDelete = () => {
    if (!preview) return;
    setError(null);
    const fd = new FormData();
    fd.set("code", preview.code);
    fd.set("confirmCode", confirmCode);
    startTransition(async () => {
      const result = await hardDeleteTicketAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(`Ticket #${result.code} und alle zugehörigen Daten wurden dauerhaft gelöscht.`);
      setPreview(null);
      setCode("");
      setConfirmCode("");
    });
  };

  return (
    <div className="bg-bg-card rounded-xl border border-danger/40 p-6 mb-6">
      <div className="mb-4">
        <h2 className="font-semibold text-danger flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Admin · Ticket hart löschen
        </h2>
        <p className="text-xs text-text-light mt-0.5">
          Löscht ein Ticket <strong>dauerhaft</strong> aus der Datenbank inklusive aller
          Nachrichten, Anhänge, Notizen, Drafts, Events und Bestellungen. Nicht rückgängig
          zu machen. Der Kunde bekommt davon nichts mit — die versendeten Mails bleiben
          bei ihm im Postfach.
        </p>
      </div>

      {success && (
        <div className="mb-3 flex items-start gap-2 text-sm bg-success/10 border border-success/30 rounded-lg p-3 text-success">
          <div>{success}</div>
        </div>
      )}

      {!preview && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-text-light">
            Ticket-Code (z.B. #ABC123 oder ABC123)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  loadPreview();
                }
              }}
              placeholder="Ticket-Code"
              className="flex-1 px-3 py-2 border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-danger/30 focus:border-danger"
            />
            <button
              onClick={loadPreview}
              disabled={pending || !code.trim()}
              className="px-4 py-2 bg-danger/10 text-danger border border-danger/30 rounded text-sm font-medium hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Prüfen"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="border border-danger/30 rounded-lg p-3 bg-danger/5">
            <div className="text-xs text-text-light uppercase mb-1">Zu löschen:</div>
            <div className="text-sm text-text">
              <div className="font-medium">
                <span className="font-mono">#{preview.code}</span> — {preview.subject}
              </div>
              <div className="text-xs text-text-light mt-1">
                Kunde: {preview.customerEmail} · Status: {preview.status}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-danger/20 flex flex-wrap gap-3 text-xs">
              <span>
                <strong className="tabular-nums">{preview.messages}</strong> Nachricht(en)
              </span>
              <span>
                <strong className="tabular-nums">{preview.attachments}</strong> Anhang/Anhänge
              </span>
              <span>
                <strong className="tabular-nums">{preview.notes}</strong> Notiz(en)
              </span>
              <span>
                <strong className="tabular-nums">{preview.drafts}</strong> AI-Draft(s)
              </span>
              <span>
                <strong className="tabular-nums">{preview.orders}</strong> Bestellung(en)
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-danger mb-1">
              Zur Bestätigung Ticket-Code nochmal eingeben: <span className="font-mono">{preview.code}</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.toUpperCase())}
                placeholder={preview.code}
                className="flex-1 px-3 py-2 border border-danger/30 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-danger/30 focus:border-danger"
              />
              <button
                onClick={doDelete}
                disabled={pending || confirmCode !== preview.code}
                className="flex items-center gap-1 px-4 py-2 bg-danger text-white rounded text-sm font-medium hover:bg-danger/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Endgültig löschen
              </button>
              <button
                onClick={() => {
                  setPreview(null);
                  setConfirmCode("");
                  setError(null);
                }}
                disabled={pending}
                className="px-3 py-2 text-text-light hover:text-text hover:bg-bg-secondary rounded text-sm"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
