"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { addContactNoteAction } from "./actions";

export function ContactNotesForm({ contactId }: { contactId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    if (!body.trim() || pending) return;
    const fd = new FormData();
    fd.set("contactId", contactId);
    fd.set("body", body);
    startTransition(async () => {
      await addContactNoteAction(fd);
      setBody("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Neue Kunden-Notiz — z.B. 'VIP', 'spricht wenig Deutsch', 'hat schon 3× Batterie reklamiert' …"
        rows={3}
        className="w-full px-3 py-2 border border-border rounded text-sm resize-y focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
      />
      <button
        onClick={submit}
        disabled={!body.trim() || pending}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white rounded text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
      >
        <Plus className="w-3.5 h-3.5" /> {pending ? "Speichern…" : "Notiz hinzufügen"}
      </button>
    </div>
  );
}
