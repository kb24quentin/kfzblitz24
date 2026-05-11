"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Upload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { uploadDocumentAction, type UploadDocState } from "./actions";

const INITIAL: UploadDocState = { ok: true };

const DOC_KINDS: { id: string; label: string }[] = [
  { id: "gewerbeschein", label: "Gewerbeschein (neu)" },
  { id: "ust_id_certificate", label: "USt-ID-Bescheinigung" },
  { id: "handelsregister", label: "Handelsregisterauszug" },
  { id: "meisterbrief", label: "Meisterbrief / Handwerksrolle" },
  { id: "firmenbriefbogen", label: "Firmen-Briefbogen / Visitenkarte" },
  { id: "personalausweis_inhaber", label: "Personalausweis (Inhaber)" },
  { id: "address_proof", label: "Adressnachweis (Mietvertrag, Rechnung)" },
  { id: "bank_statement", label: "Bankverbindungs-Nachweis" },
  { id: "other", label: "Sonstiges" },
];

export function DocUploadForm({ caseId, suggestedKind }: { caseId: string; suggestedKind?: string }) {
  const [state, action] = useActionState(uploadDocumentAction, INITIAL);
  const [kind, setKind] = useState(suggestedKind ?? "gewerbeschein");
  const formRef = useRef<HTMLFormElement>(null);

  // After successful upload, reset the form
  if (state.ok && state.message && formRef.current) {
    // small async reset to avoid re-render loop
    queueMicrotask(() => formRef.current?.reset());
  }

  return (
    <form action={action} ref={formRef} className="space-y-3">
      <input type="hidden" name="id" value={caseId} />

      <div>
        <label className="block text-xs font-medium text-text-light mb-1">Dokument-Typ</label>
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {DOC_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-light mb-1">Datei (PDF / JPG / PNG)</label>
        <input
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          className="block w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-border file:bg-bg-secondary file:text-text hover:file:bg-border/30 file:cursor-pointer"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-light mb-1">
          Notiz (optional)
        </label>
        <input
          name="note"
          type="text"
          placeholder="z.B. Per Mail nachgereicht am ..."
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      <input
        type="text"
        name="actor"
        placeholder="Bearbeiter (optional)"
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
      />

      <SubmitButton />

      {state.message && (
        <p
          className={`text-xs flex items-start gap-1.5 ${
            state.ok ? "text-green-700" : "text-red-700"
          }`}
        >
          {state.ok ? (
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          )}
          {state.message}
        </p>
      )}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-60 w-full justify-center"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> Lädt...
        </>
      ) : (
        <>
          <Upload className="w-4 h-4" /> Hochladen
        </>
      )}
    </button>
  );
}
