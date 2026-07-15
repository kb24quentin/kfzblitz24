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

type CurrentUser = {
  name: string;
  email: string;
  role?: string;
};

export function SignatureEditor({
  signature,
  currentUser,
}: {
  signature: Signature;
  currentUser?: CurrentUser;
}) {
  const [html, setHtml] = useState(
    signature?.html ?? buildDefaultSignature(currentUser),
  );
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
// Placeholders like {{name}}, {{position}}, {{email}} are substituted at load
// time from the current user; the saved HTML then has real values, not tokens.
function buildDefaultSignature(u?: CurrentUser): string {
  const name = u?.name || "Dein Name";
  const email = u?.email || "service@kfzblitz24.de";
  const position = u?.role === "admin" ? "Administrator" : "Kundenservice";
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a202c;">
  <tr>
    <td style="padding:0;">
      <div style="font-size:15px;font-weight:700;color:#0b3756;line-height:1.3;letter-spacing:-0.2px;">${name}</div>
      <div style="font-size:13px;color:#4a5568;line-height:1.5;margin-top:2px;">${position} &middot; kfzBlitz24 GmbH</div>
    </td>
  </tr>
  <tr>
    <td style="padding:12px 0 12px 0;">
      <img src="https://support.kfzblitz24-group.com/sig-logo.png" width="200" height="auto" alt="kfzBlitz24" style="display:block;border:0;outline:none;text-decoration:none;">
    </td>
  </tr>
  <tr>
    <td style="padding:0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:1px 12px 1px 0;font-size:12px;color:#718096;font-weight:600;">E-Mail</td>
          <td style="padding:1px 0;font-size:12px;"><a href="mailto:${email}" style="color:#ff6600;text-decoration:none;font-weight:600;">${email}</a></td>
        </tr>
        <tr>
          <td style="padding:1px 12px 1px 0;font-size:12px;color:#718096;font-weight:600;">Web</td>
          <td style="padding:1px 0;font-size:12px;"><a href="https://www.kfzblitz24.de" style="color:#ff6600;text-decoration:none;font-weight:600;">www.kfzblitz24.de</a></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="border-top:3px solid #ff6600;padding:8px 0 0 0;font-size:11px;line-height:1.5;color:#718096;">
      kfzBlitz24 GmbH &middot; Bomhardstra&szlig;e 7 &middot; 82031 Gr&uuml;nwald bei M&uuml;nchen<br>
      Gesch&auml;ftsf&uuml;hrer: Christian Engert &middot; HRB 291765, Amtsgericht M&uuml;nchen &middot; USt-ID: DE367617344
    </td>
  </tr>
</table>`;
}
