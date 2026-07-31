"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Save, ArrowLeft, Eye, Code, Variable, FileSignature, FileText, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { RichTextEditor, type RichTextEditorHandle } from "./rich-text-editor";

type TemplateData = {
  id?: string;
  name?: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string | null;
  signatureId?: string | null;
  letterSignatureId?: string | null;
  type?: string | null;      // "email" | "letter"
  letterPs?: string | null;
};

type LetterSignatureOption = { id: string; name: string; imageData: string };

type SignatureOption = {
  id: string;
  name: string;
  html: string;
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
  signatures,
  letterSignatures = [],
}: {
  action: (formData: FormData) => Promise<void>;
  template?: TemplateData;
  signatures: SignatureOption[];
  letterSignatures?: LetterSignatureOption[];
}) {
  const [type, setType] = useState<"email" | "letter">(
    (template?.type as "email" | "letter") ?? "email"
  );
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml || "");
  const [signatureId, setSignatureId] = useState<string>(template?.signatureId || "");
  const [letterSignatureId, setLetterSignatureId] = useState<string>(
    template?.letterSignatureId || ""
  );
  const [letterPs, setLetterPs] = useState<string>(template?.letterPs || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const selectedLetterSig = letterSignatures.find((s) => s.id === letterSignatureId);

  // ─── Brief-PDF Live-Preview ────────────────────────────────────────
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const regeneratePdf = async () => {
    if (type !== "letter") return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await fetch("/api/preview/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          bodyHtml,
          letterPs,
          letterSignatureId: letterSignatureId || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setPdfUrl(url);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : String(e));
    } finally {
      setPdfLoading(false);
    }
  };

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

  const selectedSignature = useMemo(
    () => signatures.find((s) => s.id === signatureId) ?? null,
    [signatures, signatureId]
  );

  return (
    <form action={action} className="space-y-6">
      {template?.id && <input type="hidden" name="id" value={template.id} />}
      <input type="hidden" name="bodyHtml" value={bodyHtml} />
      <input type="hidden" name="signatureId" value={signatureId} />
      <input type="hidden" name="letterSignatureId" value={letterSignatureId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="letterPs" value={letterPs} />

      {/* Template-Typ */}
      <div className="bg-bg-card rounded-xl border border-border p-6">
        <label className="block text-sm font-medium text-text mb-2">Template-Typ *</label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { id: "email", label: "E-Mail-Template", hint: "Für Kampagnen mit Kanal 'E-Mail'. HTML-Editor + Signatur-Dropdown." },
              { id: "letter", label: "Brief-Template", hint: "Für Kampagnen mit Kanal 'Brief'. Wird via OnlineBrief24 als PDF gerendert (DIN 5008)." },
            ] as const
          ).map(({ id, label, hint }) => {
            const on = type === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={`text-left p-3 rounded-lg border-2 transition-colors ${
                  on
                    ? "border-accent bg-accent/5"
                    : "border-border bg-bg-secondary hover:border-accent/40"
                }`}
              >
                <div className={`text-sm font-semibold ${on ? "text-text" : "text-text-light"}`}>{label}</div>
                <p className="text-xs text-text-light mt-1">{hint}</p>
              </button>
            );
          })}
        </div>
      </div>

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
        ) : type === "email" ? (
          // Mail-Client-Style Preview
          <div className="p-6 bg-bg-secondary/50">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-border overflow-hidden">
              {/* Mail-Header */}
              <div className="px-5 py-3 border-b border-border bg-bg-secondary/50">
                <div className="flex items-baseline gap-2 text-xs text-text-light mb-1">
                  <span className="font-semibold w-14">Von:</span>
                  <span className="text-text">Corinna Wagner - kfzBlitz24 &lt;corinna.wagner@kfzblitz24.de&gt;</span>
                </div>
                <div className="flex items-baseline gap-2 text-xs text-text-light mb-1">
                  <span className="font-semibold w-14">An:</span>
                  <span className="text-text">Max Mustermann &lt;max@musterbetrieb.de&gt;</span>
                </div>
                <div className="flex items-baseline gap-2 text-xs text-text-light">
                  <span className="font-semibold w-14">Betreff:</span>
                  <span className="text-text font-semibold">{renderPreview(subject) || "—"}</span>
                </div>
              </div>
              {/* Mail-Body */}
              <div className="px-5 py-6">
                <div
                  className="prose prose-sm max-w-none text-text"
                  dangerouslySetInnerHTML={{ __html: renderPreview(bodyHtml) }}
                />
                {selectedSignature && (
                  <div
                    className="mt-6"
                    dangerouslySetInnerHTML={{ __html: renderPreview(selectedSignature.html) }}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          // Brief-PDF Live-Preview
          <div className="p-4 bg-bg-secondary/50 space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={regeneratePdf}
                disabled={pdfLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50"
              >
                {pdfLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Rendere PDF …</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> {pdfUrl ? "PDF neu generieren" : "PDF-Vorschau generieren"}</>
                )}
              </button>
              {pdfUrl && !pdfLoading && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-accent hover:underline"
                >
                  In neuem Tab öffnen ↗
                </a>
              )}
              <span className="text-xs text-text-light ml-auto">
                Rendert mit Sample-Empfänger (Max Mustermann · Musterstraße 42 · 80331 München)
              </span>
            </div>
            {pdfError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-danger">
                Fehler beim Rendern: {pdfError}
              </div>
            )}
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                title="Brief-Vorschau"
                className="w-full border border-border rounded-lg bg-white"
                style={{ height: 780 }}
              />
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center bg-white">
                <FileText className="w-10 h-10 text-text-light/40 mx-auto mb-2" />
                <p className="text-sm text-text-light">Noch keine PDF-Vorschau generiert.</p>
                <p className="text-xs text-text-light mt-1">Klick auf &quot;PDF-Vorschau generieren&quot; oben.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Signature picker — nur bei Email-Templates */}
      {type === "email" && (
        <div className="bg-bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-text">Signatur</h3>
            <span className="text-xs text-text-light">— wird automatisch unten an jede Mail dieses Templates angehängt</span>
          </div>

          <select
            value={signatureId}
            onChange={(e) => setSignatureId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="">— Keine Signatur —</option>
            {signatures.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {selectedSignature && (
            <details className="text-xs">
              <summary className="cursor-pointer text-text-light hover:text-text">Vorschau der Signatur</summary>
              <div
                className="mt-2 p-3 border border-border rounded-lg bg-white"
                dangerouslySetInnerHTML={{ __html: renderPreview(selectedSignature.html) }}
              />
            </details>
          )}

          <p className="text-xs text-text-light">
            Signaturen werden in den{" "}
            <Link href="/settings?tab=signatures" className="text-accent hover:underline">
              Einstellungen
            </Link>{" "}
            verwaltet.
          </p>
        </div>
      )}

      {/* P.S. — nur bei Brief-Templates */}
      {type === "letter" && (
        <div className="bg-bg-card rounded-xl border border-border p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-text">P.S. (einzige Handlungsaufforderung)</h3>
            <p className="text-xs text-text-light mt-0.5">
              Laut Design-Guide: die P.S.-Zeile ist die einzige CTA im Brief. Wird nachweislich häufiger gelesen als der Fließtext.
              Variablen wie <code>{`{{first_name}}`}</code>, <code>{`{{phone}}`}</code> funktionieren auch hier.
            </p>
          </div>
          <textarea
            value={letterPs}
            onChange={(e) => setLetterPs(e.target.value)}
            rows={3}
            placeholder="Ein Anruf unter {{phone}} genügt. Nennen Sie mir einen Tag und eine Uhrzeit, die Ihnen passen."
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
          />
        </div>
      )}

      {/* Brief-Unterschrift (Bild) — nur bei Brief-Templates */}
      {type === "letter" && (
        <div className="bg-bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text">Bild-Unterschrift</h3>
            <span className="text-xs text-text-light">— wird zwischen &quot;Mit freundlichen Grüßen&quot; und dem Namen gedruckt</span>
          </div>
          <select
            value={letterSignatureId}
            onChange={(e) => setLetterSignatureId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="">— Keine (nur Freiraum für handschriftliche Unterschrift) —</option>
            {letterSignatures.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {selectedLetterSig && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={selectedLetterSig.imageData}
              alt="Vorschau"
              className="max-h-16 object-contain bg-white border border-border rounded p-2"
            />
          )}
          <p className="text-xs text-text-light">
            Verwaltet in{" "}
            <Link href="/settings?tab=signatures" className="text-accent hover:underline">
              Einstellungen → Signaturen
            </Link>
            {" "}(unten: &quot;Brief-Unterschriften&quot;).
          </p>
        </div>
      )}

      {/* Hinweis-Card bei Brief-Templates */}
      {type === "letter" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1">
          <p className="font-semibold">Design-Guide: Brief (Stil &quot;dezent&quot;)</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>Genau 1 Seite, 150-180 Wörter, 3 Absätze + P.S.</li>
            <li>1. Absatz: wer schreibt + warum · 2. Absatz: was wir wollen · 3. Absatz: konkreter Vorschlag mit Ausstieg</li>
            <li>Sie-Form, kein Blocksatz, keine Bullets/Boxes/Tabellen im Fließtext</li>
            <li>Genau 1 CTA — steht im P.S., nicht im Fließtext</li>
            <li>Anrede wird im Brief oben gerendert; erste Textzeile sollte mit &quot;Sehr geehrter Herr/Frau ...&quot; beginnen</li>
          </ul>
        </div>
      )}

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
