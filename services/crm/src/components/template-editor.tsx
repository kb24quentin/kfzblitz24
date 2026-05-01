"use client";

import { useState, useRef } from "react";
import { Save, ArrowLeft, Eye, Code, Variable, FileSignature } from "lucide-react";
import Link from "next/link";
import { RichTextEditor, type RichTextEditorHandle } from "./rich-text-editor";

type TemplateData = {
  id?: string;
  name?: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string | null;
  signature?: string | null;
};

const AVAILABLE_VARIABLES = [
  { name: "salutation", label: "Anrede" },
  { name: "first_name", label: "Vorname" },
  { name: "last_name", label: "Nachname" },
  { name: "email", label: "Email" },
  { name: "company", label: "Firma" },
  { name: "position", label: "Position" },
  { name: "city", label: "Stadt" },
  { name: "phone", label: "Telefon" },
];

const SAMPLE_DATA: Record<string, string> = {
  salutation: "Herr",
  first_name: "Max",
  last_name: "Mustermann",
  email: "max@autohaus-mueller.de",
  company: "Autohaus Müller",
  position: "Geschäftsführer",
  city: "München",
  phone: "+49 89 123456",
};

export function TemplateEditor({
  action,
  template,
}: {
  action: (formData: FormData) => Promise<void>;
  template?: TemplateData;
}) {
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml || "");
  const [signature, setSignature] = useState(template?.signature || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef<RichTextEditorHandle>(null);

  const insertVariable = (varName: string) => {
    editorRef.current?.insertText(`{{${varName}}}`);
  };

  const renderPreview = (text: string) => {
    let rendered = text;
    for (const [key, value] of Object.entries(SAMPLE_DATA)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    return rendered;
  };

  const detectedVars = [...new Set((bodyHtml.match(/\{\{(\w+)\}\}/g) || []).map(m => m.replace(/\{\{|\}\}/g, "")))];

  return (
    <form action={action} className="space-y-6">
      {template?.id && <input type="hidden" name="id" value={template.id} />}
      <input type="hidden" name="bodyHtml" value={bodyHtml} />
      <input type="hidden" name="signature" value={signature} />

      <div className="bg-bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Template Name *</label>
            <input
              name="name"
              required
              defaultValue={template?.name}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              placeholder="Erstansprache Autohäuser"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Betreff *</label>
            <input
              name="subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              placeholder="Originalersatzteile für {{company}}"
            />
          </div>
        </div>
      </div>

      {/* Variable Palette */}
      <div className="bg-bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Variable className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text">Variablen einfügen</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_VARIABLES.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => insertVariable(v.name)}
              className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-full hover:bg-accent/20 transition-colors font-medium"
            >
              {`{{${v.name}}}`} <span className="text-accent/60">({v.label})</span>
            </button>
          ))}
        </div>
        {detectedVars.length > 0 && (
          <p className="text-xs text-text-light mt-2">
            Verwendete Variablen: {detectedVars.map(v => `{{${v}}}`).join(", ")}
          </p>
        )}
      </div>

      {/* Editor / Preview Toggle */}
      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              !showPreview ? "bg-bg-secondary text-text border-b-2 border-accent" : "text-text-light hover:text-text"
            }`}
          >
            <Code className="w-4 h-4" /> Editor
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              showPreview ? "bg-bg-secondary text-text border-b-2 border-accent" : "text-text-light hover:text-text"
            }`}
          >
            <Eye className="w-4 h-4" /> Vorschau
          </button>
        </div>

        {!showPreview ? (
          <div className="p-3">
            <RichTextEditor
              ref={editorRef}
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Hallo {{first_name}}, …"
              minHeight={320}
            />
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-4 pb-3 border-b border-border">
              <p className="text-xs text-text-light mb-1">Betreff:</p>
              <p className="text-sm font-medium">{renderPreview(subject)}</p>
            </div>
            <div
              className="prose prose-sm max-w-none text-text"
              dangerouslySetInnerHTML={{ __html: renderPreview(bodyHtml) }}
            />
            {signature && (
              <>
                <hr className="my-4 border-border" />
                <div
                  className="prose prose-sm max-w-none text-text"
                  dangerouslySetInnerHTML={{ __html: renderPreview(signature) }}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Signature */}
      <div className="bg-bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-text">HTML-Signatur</h3>
          <span className="text-xs text-text-light">— wird automatisch unten an jede Mail dieses Templates angehängt</span>
        </div>
        <RichTextEditor
          value={signature}
          onChange={setSignature}
          placeholder={'<p>Mit freundlichen Grüßen<br>Corinna Wagner – kfzBlitz24<br><a href="https://kfzblitz24.de">kfzblitz24.de</a></p>'}
          minHeight={140}
        />
        <p className="text-xs text-text-light">
          Variablen wie <code>{`{{first_name}}`}</code> funktionieren auch hier, falls du den Empfänger persönlich grüßen willst. Lass das Feld leer, wenn du keine Signatur willst.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Save className="w-4 h-4" />
          Speichern
        </button>
        <Link
          href="/templates"
          className="flex items-center gap-2 px-5 py-2.5 bg-bg-card border border-border text-text rounded-lg text-sm font-medium hover:bg-bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
