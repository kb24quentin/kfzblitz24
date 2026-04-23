"use client";

import { useState } from "react";
import { Save, ArrowLeft, Users, Zap } from "lucide-react";
import Link from "next/link";

type Template = { id: string; name: string; subject: string };
type Contact = { id: string; firstName: string; lastName: string; email: string; company: string | null };

export function CampaignForm({
  action,
  templates,
  contacts,
}: {
  action: (formData: FormData) => Promise<void>;
  templates: Template[];
  contacts: Contact[];
}) {
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [enableAB, setEnableAB] = useState(false);
  const [enableFollowUp, setEnableFollowUp] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const toggleAll = () => {
    if (selectAll) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((c) => c.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleContact = (id: string) => {
    const next = new Set(selectedContacts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContacts(next);
  };

  return (
    <form
      action={(formData) => {
        formData.set("contactIds", JSON.stringify([...selectedContacts]));
        return action(formData);
      }}
      className="space-y-6"
    >
      {/* Campaign Info */}
      <div className="bg-bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-text">Kampagnen-Details</h3>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Kampagnenname *</label>
          <input
            name="name"
            required
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            placeholder="Erstansprache Autohäuser München Q2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Template A *</label>
          <select
            name="templateAId"
            required
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="">Template wählen...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name} – {t.subject}</option>
            ))}
          </select>
        </div>

        {/* A/B Testing */}
        <div className="border-t border-border pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableAB}
              onChange={(e) => setEnableAB(e.target.checked)}
              className="rounded border-border"
            />
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-text">A/B Testing aktivieren</span>
          </label>

          {enableAB && (
            <div className="mt-3 pl-6 space-y-3">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Template B</label>
                <select
                  name="templateBId"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="">Template wählen...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} – {t.subject}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Split-Verhältnis (% Template A)
                </label>
                <input
                  name="abSplitRatio"
                  type="range"
                  min="10"
                  max="90"
                  step="10"
                  defaultValue="50"
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-xs text-text-light">
                  <span>10% A / 90% B</span>
                  <span>50/50</span>
                  <span>90% A / 10% B</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send Settings */}
      <div className="bg-bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-text">Versand-Einstellungen</h3>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Emails pro Tag (max)
          </label>
          <input
            name="sendRatePerDay"
            type="number"
            min="1"
            max="100"
            defaultValue="50"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        {/* Follow-Up */}
        <div className="border-t border-border pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="followUpEnabled"
              value="true"
              checked={enableFollowUp}
              onChange={(e) => setEnableFollowUp(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm font-medium text-text">Automatisches Follow-Up</span>
          </label>

          {enableFollowUp && (
            <div className="mt-3 pl-6 space-y-3">
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Follow-Up nach X Tagen (ohne Antwort)
                </label>
                <input
                  name="followUpDelayDays"
                  type="number"
                  min="1"
                  max="30"
                  defaultValue="3"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">Follow-Up Template</label>
                <select
                  name="followUpTemplateId"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="">Gleiches Template verwenden</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contact Selection */}
      <div className="bg-bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text flex items-center gap-2">
            <Users className="w-4 h-4" />
            Kontakte auswählen ({selectedContacts.size} ausgewählt)
          </h3>
          <button
            type="button"
            onClick={toggleAll}
            className="text-sm text-accent hover:text-accent-light transition-colors"
          >
            {selectAll ? "Keine auswählen" : "Alle auswählen"}
          </button>
        </div>

        {contacts.length === 0 ? (
          <p className="text-sm text-text-light text-center py-4">
            Keine Kontakte verfügbar. <Link href="/contacts/new" className="text-accent hover:underline">Kontakte anlegen</Link>
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {contacts.map((contact) => (
              <label
                key={contact.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-secondary cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedContacts.has(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                  className="rounded border-border"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {contact.firstName} {contact.lastName}
                  </span>
                  <span className="text-xs text-text-light ml-2">{contact.email}</span>
                  {contact.company && (
                    <span className="text-xs text-text-light ml-2">· {contact.company}</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={selectedContacts.size === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Kampagne erstellen
        </button>
        <Link
          href="/campaigns"
          className="flex items-center gap-2 px-5 py-2.5 bg-bg-card border border-border text-text rounded-lg text-sm font-medium hover:bg-bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
