"use client";

import { useState } from "react";
import { FileSignature, Plus, Trash2, Edit, Eye, X, Check } from "lucide-react";
import { createSignature, updateSignature, deleteSignature } from "./actions";

type Signature = {
  id: string;
  name: string;
  html: string;
  updatedAt: Date;
};

export function SignaturesManager({ signatures }: { signatures: Signature[] }) {
  const [editing, setEditing] = useState<Signature | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-text">E-Mail-Signaturen</h2>
          <p className="text-xs text-text-light mt-0.5">
            Hier verwaltete Signaturen sind in jedem Template auswählbar.
          </p>
        </div>
        {!creating && !editing && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Plus className="w-4 h-4" /> Neue Signatur
          </button>
        )}
      </div>

      {/* Edit / Create form */}
      {(creating || editing) && (
        <SignatureForm
          signature={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {/* List */}
      {signatures.length === 0 && !creating ? (
        <div className="bg-bg-card rounded-xl border border-border p-8 text-center">
          <FileSignature className="w-8 h-8 text-text-light/40 mx-auto mb-2" />
          <p className="text-sm text-text-light">
            Noch keine Signaturen angelegt. Klick auf &quot;Neue Signatur&quot; um eine zu erstellen.
          </p>
        </div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          {signatures.map((sig, i) => (
            <div
              key={sig.id}
              className={`p-4 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex items-center gap-3">
                <FileSignature className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{sig.name}</p>
                  <p className="text-xs text-text-light">
                    Zuletzt geändert: {new Date(sig.updatedAt).toLocaleString("de-DE")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewId(previewId === sig.id ? null : sig.id)}
                  className="p-1.5 hover:bg-bg-secondary rounded text-text-light hover:text-text"
                  title="Vorschau"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(sig)}
                  className="p-1.5 hover:bg-bg-secondary rounded text-text-light hover:text-text"
                  title="Bearbeiten"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <form
                  action={deleteSignature}
                  onSubmit={(e) => {
                    if (!confirm(`Signatur "${sig.name}" wirklich löschen?`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={sig.id} />
                  <button
                    type="submit"
                    className="p-1.5 hover:bg-red-50 rounded text-text-light hover:text-danger transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </form>
              </div>
              {previewId === sig.id && (
                <div className="mt-3 ml-7 p-4 border border-border rounded-lg bg-white">
                  <div dangerouslySetInnerHTML={{ __html: sig.html }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SignatureForm({
  signature,
  onClose,
}: {
  signature: Signature | null;
  onClose: () => void;
}) {
  const [html, setHtml] = useState(signature?.html ?? "");
  const [showPreview, setShowPreview] = useState(false);
  const isEdit = !!signature;

  return (
    <form
      action={async (formData) => {
        if (isEdit) {
          formData.set("id", signature!.id);
          await updateSignature(formData);
        } else {
          await createSignature(formData);
        }
        onClose();
      }}
      className="bg-bg-card rounded-xl border border-accent/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text text-sm">
          {isEdit ? `Signatur bearbeiten: ${signature.name}` : "Neue Signatur"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-text-light hover:text-text p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-light mb-1">Name</label>
        <input
          name="name"
          required
          defaultValue={signature?.name ?? ""}
          placeholder="z.B. Standard, Vertrieb B2B, Mit CTA …"
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-text-light">HTML</label>
          {html.trim() && (
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-accent hover:underline"
            >
              {showPreview ? "Code zeigen" : "Vorschau zeigen"}
            </button>
          )}
        </div>
        {showPreview ? (
          <div
            className="min-h-[180px] p-4 border border-border rounded-lg bg-white"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <textarea
            name="html"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            required
            spellCheck={false}
            placeholder='<table>...</table>'
            className="w-full px-3 py-2 border border-border rounded-lg text-xs font-mono bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
            style={{ minHeight: 200 }}
          />
        )}
        {showPreview && (
          <input type="hidden" name="html" value={html} />
        )}
      </div>

      <p className="text-xs text-text-light">
        Variablen wie <code>{`{{first_name}}`}</code>, <code>{`{{salutation}}`}</code> etc. werden beim Versand durch Empfänger-Daten ersetzt.
      </p>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> {isEdit ? "Speichern" : "Erstellen"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-text-light hover:text-text text-sm"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
