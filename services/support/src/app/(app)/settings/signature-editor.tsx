"use client";

import { useState } from "react";
import { FileSignature, Trash2, Check, Eye, Code2 } from "lucide-react";
import { saveMySignatureAction, deleteMySignatureAction } from "./actions";

type Signature = {
  id: string;
  name: string;
  html: string;
  updatedAt: Date;
} | null;

export function SignatureEditor({ signature }: { signature: Signature }) {
  const [html, setHtml] = useState(signature?.html ?? DEFAULT_SIGNATURE_HTML);
  const [name, setName] = useState(signature?.name ?? "Standard");
  const [showPreview, setShowPreview] = useState(true);

  return (
    <div className="bg-bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-text flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-accent" /> Meine Signatur
          </h2>
          <p className="text-xs text-text-light mt-0.5">
            Wird automatisch an alle deine ausgehenden Antworten angehängt.
          </p>
        </div>
        {signature && (
          <span className="text-xs text-text-light">
            Zuletzt geändert:{" "}
            {new Date(signature.updatedAt).toLocaleString("de-DE")}
          </span>
        )}
      </div>

      <form action={saveMySignatureAction} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-text-light mb-1">
            Name (nur intern)
          </label>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-text-light">HTML</label>
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
                  <Eye className="w-3 h-3" /> Vorschau zeigen
                </>
              )}
            </button>
          </div>
          {showPreview ? (
            <div
              className="min-h-[200px] p-4 border border-border rounded-lg bg-white"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <textarea
              name="html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              required
              spellCheck={false}
              className="w-full px-3 py-2 border border-border rounded-lg text-xs font-mono bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
              style={{ minHeight: 220 }}
            />
          )}
          {showPreview && <input type="hidden" name="html" value={html} />}
        </div>

        <p className="text-xs text-text-light">
          Tipp: Verwende die Table-basierte Signatur (siehe Default oben), das
          rendert in allen Mail-Clients konsistent — auch in Outlook.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Speichern
          </button>
          {signature && (
            <form action={deleteMySignatureAction}>
              <button
                type="submit"
                onClick={(e) => {
                  if (!confirm("Signatur wirklich löschen?")) e.preventDefault();
                }}
                className="flex items-center gap-1 px-3 py-2 text-text-light hover:text-danger hover:bg-danger/10 rounded-lg text-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Löschen
              </button>
            </form>
          )}
        </div>
      </form>
    </div>
  );
}

// Table-based default signature — inline styles so it survives Gmail/Outlook.
// Uses kfzBlitz24 brand colors (NAVY #0b3756, ORANGE #ff6600).
const DEFAULT_SIGNATURE_HTML = `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;font-size:13px;color:#3d4654;line-height:1.5">
  <tr>
    <td style="padding-right:16px;border-right:2px solid #ff6600;vertical-align:top">
      <div style="font-weight:bold;color:#0b3756;font-size:15px">Dein Name</div>
      <div style="color:#8a93a0;font-size:12px">Kundenservice</div>
    </td>
    <td style="padding-left:16px;vertical-align:top">
      <div><strong style="color:#0b3756">kfz</strong><strong style="color:#ff6600">blitz</strong><strong style="color:#0b3756">24</strong></div>
      <div><a href="mailto:service@kfzblitz24.de" style="color:#3d4654;text-decoration:none">service@kfzblitz24.de</a></div>
      <div><a href="https://kfzblitz24.de" style="color:#3d4654;text-decoration:none">kfzblitz24.de</a></div>
    </td>
  </tr>
</table>`;
