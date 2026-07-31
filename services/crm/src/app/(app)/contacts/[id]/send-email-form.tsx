"use client";

import { useActionState, useEffect, useState } from "react";
import { Send, CheckCircle, XCircle, Mail, X, AtSign } from "lucide-react";
import { sendDirectEmail, type SendDirectEmailResult } from "./actions";
import { RichTextEditor } from "@/components/rich-text-editor";

const initial: SendDirectEmailResult = { ok: false, message: "" };

type Sender = { id: string; name: string; email: string };

export function SendEmailForm({
  contactId,
  contactEmail,
  contactName,
  senders,
}: {
  contactId: string;
  contactEmail: string;
  contactName: string;
  senders: Sender[];
}) {
  const [state, formAction, pending] = useActionState(sendDirectEmail, initial);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [senderId, setSenderId] = useState<string>("");

  // Close on ESC + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // On successful send, auto-close after a short beat so the user sees the confirmation
  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => {
        setOpen(false);
        setBody("");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [state.ok]);

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
      >
        <Mail className="w-4 h-4" /> Mail an Kontakt schreiben
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Mail an Kontakt"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-card w-full max-w-2xl max-h-[90vh] rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-secondary/50">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-accent shrink-0" />
                <h3 className="font-semibold text-sm text-text truncate">
                  Mail an {contactName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-bg-card rounded-lg transition-colors"
                aria-label="Schließen"
              >
                <X className="w-4 h-4 text-text-light" />
              </button>
            </div>

            {/* Scrollable body */}
            <form action={formAction} className="flex flex-col min-h-0 flex-1">
              <input type="hidden" name="contactId" value={contactId} />
              <input type="hidden" name="body" value={body} />

              <div className="p-5 space-y-3 overflow-y-auto flex-1">
                {/* Sender + An in a row on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-text-light mb-1 flex items-center gap-1.5">
                      <AtSign className="w-3 h-3" /> Absender
                    </label>
                    <select
                      name="senderId"
                      value={senderId}
                      onChange={(e) => setSenderId(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-card focus:outline-none focus:ring-2 focus:ring-accent/50"
                    >
                      <option value="">Standard-Absender</option>
                      {senders.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-light mb-1 block">An</label>
                    <div className="px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary font-mono truncate">
                      {contactEmail}
                    </div>
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
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-text-light mb-1 block">Inhalt</label>
                  <RichTextEditor
                    value={body}
                    onChange={setBody}
                    placeholder={`Hallo ${contactName.split(" ")[0]}, …`}
                    minHeight={220}
                  />
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
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-bg-secondary/50">
                <span className="text-xs text-text-light">Wird im Verlauf protokolliert.</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-3 py-2 text-sm text-text-light hover:text-text transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !body.trim()}
                    className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> {pending ? "Sende…" : "Senden"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
