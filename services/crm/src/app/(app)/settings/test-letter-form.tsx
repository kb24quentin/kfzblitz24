"use client";

import { useActionState } from "react";
import { Send, CheckCircle, XCircle, FileText } from "lucide-react";
import { sendTestLetter, type TestLetterState } from "./actions";

const initial: TestLetterState = { ok: false, message: "" };

const DEFAULT_BODY = `mein Name ist Corinna Wagner, ich bin bei kfzBlitz24 im Vertrieb tätig. Dieser Brief prüft nur, ob unser Versand über OnlineBrief24 sauber funktioniert.

Bitte einmal die Seite anschauen: Adressfeld korrekt im Fenster? Betreff, Absätze und Fußzeile wie erwartet?

Falls alles passt, können wir den Live-Modus aktivieren.`;

type LetterSigOption = { id: string; name: string };

export function TestLetterForm({ letterSignatures = [] }: { letterSignatures?: LetterSigOption[] }) {
  const [state, formAction, pending] = useActionState(sendTestLetter, initial);

  return (
    <div className="bg-bg-card rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-orange-100 w-10 h-10 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="font-semibold text-text">Testbrief senden</h3>
          <p className="text-xs text-text-light">
            Rendert eine Brief-PDF (DIN 5008) und legt sie im aktuellen OB24-Modus ab
            (Test-Modus = Warenkorb, keine echten Kosten).
          </p>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        {/* Empfänger */}
        <div>
          <p className="text-xs font-semibold text-text-light uppercase tracking-wide mb-2">Empfänger</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Firma (optional)</label>
              <input name="company" defaultValue="kfzBlitz24 GmbH" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Anrede *</label>
              <select name="salutation" required defaultValue="Herr" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary">
                <option value="" disabled>— wählen —</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Vorname *</label>
              <input name="firstName" required defaultValue="Christian" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Nachname *</label>
              <input name="lastName" required defaultValue="Engert" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Straße *</label>
              <input name="street" required defaultValue="Bomhardstraße" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Nr.</label>
              <input name="houseNumber" defaultValue="7" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">PLZ *</label>
              <input name="zipCode" required inputMode="numeric" defaultValue="82031" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Stadt *</label>
              <input name="city" required defaultValue="Grünwald" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary" />
            </div>
          </div>
        </div>

        {/* Brief-Inhalt */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-semibold text-text-light uppercase tracking-wide mb-2">Brief-Inhalt</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Betreff *</label>
              <input
                name="subject"
                required
                defaultValue="Testbrief aus dem kfzBlitz24 CRM"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Anrede-Zeile *</label>
              <input
                name="anrede"
                required
                defaultValue="Sehr geehrter Herr Engert,"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Brieftext *</label>
              <textarea
                name="body"
                required
                rows={8}
                defaultValue={DEFAULT_BODY}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary resize-y font-mono"
              />
              <p className="text-xs text-text-light mt-1">Absätze durch Leerzeile trennen.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">P.S. (optional)</label>
              <textarea
                name="ps"
                rows={2}
                placeholder="Falls Sie Rückfragen haben, ein Anruf unter +49 89 ... genügt."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Unterschrift (Name)</label>
              <input
                name="signatureName"
                defaultValue="Corinna Wagner"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">
                Bild-Unterschrift (optional)
              </label>
              <select
                name="letterSignatureId"
                defaultValue=""
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-bg-secondary"
              >
                <option value="">— Nur Freiraum für handschriftliche Unterschrift —</option>
                {letterSignatures.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-xs text-text-light mt-1">
                Verwaltet unter <b>Signaturen → Brief-Unterschriften</b>.
              </p>
            </div>
          </div>
        </div>

        {/* Druck-Optionen */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-semibold text-text-light uppercase tracking-wide mb-2">Druck</p>
          <div>
            <label className="block text-xs font-medium text-text-light mb-2">Farbe</label>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <input type="radio" name="color" value="bw" defaultChecked className="peer sr-only" />
                <div className="p-3 rounded-lg border-2 border-border peer-checked:border-accent peer-checked:bg-accent/5 text-center transition-colors">
                  <div className="text-sm font-semibold text-text">Schwarz-Weiß</div>
                  <div className="text-xs text-text-light mt-0.5">günstiger, für Standard-Briefe</div>
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input type="radio" name="color" value="color" className="peer sr-only" />
                <div className="p-3 rounded-lg border-2 border-border peer-checked:border-accent peer-checked:bg-accent/5 text-center transition-colors">
                  <div className="text-sm font-semibold text-text">Farbe</div>
                  <div className="text-xs text-text-light mt-0.5">für Logo + oranger Akzent</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {pending ? "Sende…" : "Testbrief absenden"}
          </button>
          <span className="text-xs text-text-light">
            OB24-Modus (Test/Live) wird oben in der Karte „OB24 · Modus" verwaltet —
            Admins können dort umschalten (mit Google-Re-Auth).
          </span>
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
      </form>
    </div>
  );
}
