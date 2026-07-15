"use client";

import { useState } from "react";
import { FileSignature, RotateCcw, Check } from "lucide-react";
import { saveMySignatureAction, resetMySignatureAction } from "./actions";

type SignatureFields = {
  displayName: string;
  position: string;
  updatedAt?: Date;
};

export function SignatureEditor({
  signature,
  defaults,
  signatureEmail,
}: {
  signature: SignatureFields | null;
  defaults: { displayName: string; position: string };
  signatureEmail: string;
}) {
  const initial = signature ?? defaults;
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [position, setPosition] = useState(initial.position);

  return (
    <div className="bg-bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-text flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-accent" /> Meine Signatur
          </h2>
          <p className="text-xs text-text-light mt-0.5">
            Wird automatisch an alle deine ausgehenden Antworten angehängt. Design,
            E-Mail-Adresse und Impressum sind fix — du kannst nur Name und Position
            anpassen.
          </p>
        </div>
        {signature?.updatedAt && (
          <span className="text-xs text-text-light">
            Zuletzt geändert:{" "}
            {new Date(signature.updatedAt).toLocaleString("de-DE")}
          </span>
        )}
      </div>

      <form action={saveMySignatureAction} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-light mb-1">
              Name
            </label>
            <input
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={80}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-light mb-1">
              Position
            </label>
            <input
              name="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              required
              maxLength={80}
              placeholder="z.B. Kundenservice"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-light mb-1">
              E-Mail <span className="font-normal text-text-light/70">(fix)</span>
            </label>
            <input
              type="email"
              value={signatureEmail}
              disabled
              readOnly
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary text-text-light cursor-not-allowed"
            />
            <p className="text-xs text-text-light mt-1">
              Zentral über die System-Konfiguration gesteuert.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Speichern
            </button>
            {signature && (
              <button
                type="submit"
                formAction={resetMySignatureAction}
                onClick={(e) => {
                  if (!confirm("Signatur auf System-Defaults zurücksetzen?"))
                    e.preventDefault();
                }}
                className="flex items-center gap-1 px-3 py-2 text-text-light hover:text-text hover:bg-bg-secondary rounded-lg text-sm transition-colors"
                title="Zurück auf Werte aus deinem User-Profil"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Zurücksetzen
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-text-light mb-1">Vorschau</div>
          <div className="p-4 border border-border rounded-lg bg-white overflow-x-auto">
            <SignaturePreview
              displayName={displayName || defaults.displayName}
              position={position || defaults.position}
              email={signatureEmail}
            />
          </div>
        </div>
      </form>
    </div>
  );
}

function SignaturePreview({
  displayName,
  position,
  email,
}: {
  displayName: string;
  position: string;
  email: string;
}) {
  return (
    <table
      cellSpacing={0}
      cellPadding={0}
      style={{
        borderCollapse: "collapse",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
        color: "#1a202c",
      }}
    >
      <tbody>
        <tr>
          <td style={{ padding: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#0b3756",
                lineHeight: 1.3,
                letterSpacing: "-0.2px",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#4a5568",
                lineHeight: 1.5,
                marginTop: 2,
              }}
            >
              {position} · kfzBlitz24 GmbH
            </div>
          </td>
        </tr>
        <tr>
          <td style={{ padding: "12px 0" }}>
            <img
              src="/sig-logo.png"
              width={200}
              height="auto"
              alt="kfzBlitz24"
              style={{ display: "block", border: 0 }}
            />
          </td>
        </tr>
        <tr>
          <td style={{ padding: 0 }}>
            <table cellSpacing={0} cellPadding={0} style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: "1px 12px 1px 0",
                      fontSize: 12,
                      color: "#718096",
                      fontWeight: 600,
                    }}
                  >
                    E-Mail
                  </td>
                  <td style={{ padding: "1px 0", fontSize: 12 }}>
                    <a
                      href={`mailto:${email}`}
                      style={{ color: "#ff6600", textDecoration: "none", fontWeight: 600 }}
                    >
                      {email}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "1px 12px 1px 0",
                      fontSize: 12,
                      color: "#718096",
                      fontWeight: 600,
                    }}
                  >
                    Web
                  </td>
                  <td style={{ padding: "1px 0", fontSize: 12 }}>
                    <a
                      href="https://www.kfzblitz24.de"
                      style={{ color: "#ff6600", textDecoration: "none", fontWeight: 600 }}
                    >
                      www.kfzblitz24.de
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td
            style={{
              borderTop: "3px solid #ff6600",
              padding: "8px 0 0 0",
              fontSize: 11,
              lineHeight: 1.5,
              color: "#718096",
            }}
          >
            kfzBlitz24 GmbH · Bomhardstraße 7 · 82031 Grünwald bei München
            <br />
            Geschäftsführer: Christian Engert · HRB 291765, Amtsgericht München · USt-ID: DE367617344
          </td>
        </tr>
      </tbody>
    </table>
  );
}
