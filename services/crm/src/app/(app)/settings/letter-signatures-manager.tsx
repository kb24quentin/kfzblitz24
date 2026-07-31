"use client";

import { useRef, useState } from "react";
import { PenTool, Plus, Trash2, Edit, X, Check } from "lucide-react";
import { createLetterSignature, updateLetterSignature, deleteLetterSignature } from "./actions";

type LetterSig = {
  id: string;
  name: string;
  signerName: string | null;
  imageData: string;
  updatedAt: Date;
};

export function LetterSignaturesManager({ signatures }: { signatures: LetterSig[] }) {
  const [editing, setEditing] = useState<LetterSig | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-text">Brief-Unterschriften</h2>
          <p className="text-xs text-text-light mt-0.5">
            Bild-Signaturen die im Brief zwischen Grußformel und Name gedruckt werden.
            Format: PNG mit transparentem Hintergrund, ~800×280px oder ähnlich.
          </p>
        </div>
        {!creating && !editing && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Plus className="w-4 h-4" /> Neue Unterschrift
          </button>
        )}
      </div>

      {(creating || editing) && (
        <LetterSignatureForm
          signature={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {signatures.length === 0 && !creating ? (
        <div className="bg-bg-card rounded-xl border border-border p-8 text-center">
          <PenTool className="w-8 h-8 text-text-light/40 mx-auto mb-2" />
          <p className="text-sm text-text-light">
            Noch keine Brief-Unterschriften hochgeladen.
          </p>
        </div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          {signatures.map((s, i) => (
            <div key={s.id} className={`p-4 flex items-center gap-4 ${i > 0 ? "border-t border-border" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.imageData}
                alt={s.name}
                className="w-32 h-14 object-contain bg-white border border-border rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{s.name}</p>
                {s.signerName && (
                  <p className="text-xs text-text-light">gedruckter Name: {s.signerName}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditing(s)}
                className="p-1.5 hover:bg-bg-secondary rounded text-text-light hover:text-text"
                title="Bearbeiten"
              >
                <Edit className="w-4 h-4" />
              </button>
              <form
                action={deleteLetterSignature}
                onSubmit={(e) => {
                  if (!confirm(`Unterschrift "${s.name}" wirklich löschen?`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={s.id} />
                <button
                  type="submit"
                  className="p-1.5 hover:bg-red-50 rounded text-text-light hover:text-danger transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LetterSignatureForm({
  signature,
  onClose,
}: {
  signature: LetterSig | null;
  onClose: () => void;
}) {
  const isEdit = !!signature;
  const [imageData, setImageData] = useState<string>(signature?.imageData ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <form
      action={async (formData) => {
        if (isEdit) {
          formData.set("id", signature!.id);
          // Nur neues Bild übertragen wenn geändert
          if (imageData !== signature!.imageData) {
            formData.set("imageData", imageData);
          } else {
            formData.delete("imageData");
          }
          await updateLetterSignature(formData);
        } else {
          formData.set("imageData", imageData);
          await createLetterSignature(formData);
        }
        onClose();
      }}
      className="bg-bg-card rounded-xl border border-accent/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text text-sm">
          {isEdit ? `Bearbeiten: ${signature.name}` : "Neue Brief-Unterschrift"}
        </h3>
        <button type="button" onClick={onClose} className="text-text-light hover:text-text p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-light mb-1">Bezeichnung *</label>
          <input
            name="name"
            required
            defaultValue={signature?.name ?? ""}
            placeholder="z.B. Christian Engert - Unterschrift"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-light mb-1">Name unter Bild (optional)</label>
          <input
            name="signerName"
            defaultValue={signature?.signerName ?? ""}
            placeholder="Christian Engert"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-light mb-1">
          Unterschrift-Bild {isEdit && "(nur ändern wenn nötig)"}{!isEdit && "*"}
        </label>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-accent transition-colors"
        >
          {imageData ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageData}
                alt="Preview"
                className="mx-auto max-h-24 object-contain bg-white border border-border rounded p-2"
              />
              <p className="text-xs text-text-light mt-2">Klick oder Datei hierher ziehen zum Ersetzen</p>
            </>
          ) : (
            <>
              <PenTool className="w-8 h-8 text-text-light/40 mx-auto mb-2" />
              <p className="text-sm text-text-light">PNG hierher ziehen oder klicken</p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      <p className="text-xs text-text-light">
        Empfohlen: PNG mit transparentem Hintergrund, Auflösung ~800×280 px.
        Wird im Brief auf 130×45pt skaliert (ca. 4.6×1.6 cm).
      </p>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!imageData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" /> {isEdit ? "Speichern" : "Erstellen"}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-text-light hover:text-text text-sm">
          Abbrechen
        </button>
      </div>
    </form>
  );
}
