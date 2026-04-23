"use client";

import { useMemo, useState } from "react";
import { Save, ArrowLeft, Users, Zap, Filter } from "lucide-react";
import Link from "next/link";

type Template = { id: string; name: string; subject: string };
type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  status: string;
  outreach: string;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "new", label: "Neu" },
  { value: "contacted", label: "Kontaktiert" },
  { value: "replied", label: "Geantwortet" },
  { value: "interested", label: "Interessiert" },
  { value: "not_interested", label: "Kein Interesse" },
  { value: "customer", label: "Kunde" },
];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  replied: "bg-green-100 text-green-700",
  interested: "bg-emerald-100 text-emerald-700",
  not_interested: "bg-red-100 text-red-700",
  customer: "bg-purple-100 text-purple-700",
};

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label])
);

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

  // Filters — defaults: only fresh leads, exclude in-person ("local")
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    new Set(["new", "contacted"])
  );
  const [outreachFilter, setOutreachFilter] = useState<"remote" | "local" | "all">(
    "remote"
  );

  const visibleContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (statusFilter.size > 0 && !statusFilter.has(c.status)) return false;
      if (outreachFilter !== "all" && c.outreach !== outreachFilter) return false;
      return true;
    });
  }, [contacts, statusFilter, outreachFilter]);

  const toggleStatus = (s: string) => {
    const next = new Set(statusFilter);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setStatusFilter(next);
  };

  const allVisibleSelected =
    visibleContacts.length > 0 &&
    visibleContacts.every((c) => selectedContacts.has(c.id));

  const toggleAllVisible = () => {
    const next = new Set(selectedContacts);
    if (allVisibleSelected) {
      visibleContacts.forEach((c) => next.delete(c.id));
    } else {
      visibleContacts.forEach((c) => next.add(c.id));
    }
    setSelectedContacts(next);
  };

  const toggleContact = (id: string) => {
    const next = new Set(selectedContacts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContacts(next);
  };

  const counts = useMemo(() => {
    const localCount = contacts.filter((c) => c.outreach === "local").length;
    const totalSelected = selectedContacts.size;
    const localSelected = contacts.filter(
      (c) => c.outreach === "local" && selectedContacts.has(c.id)
    ).length;
    return { localCount, totalSelected, localSelected };
  }, [contacts, selectedContacts]);

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
              <option key={t.id} value={t.id}>
                {t.name} – {t.subject}
              </option>
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
                    <option key={t.id} value={t.id}>
                      {t.name} – {t.subject}
                    </option>
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
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contact Selection */}
      <div className="bg-bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text flex items-center gap-2">
            <Users className="w-4 h-4" />
            Kontakte ({selectedContacts.size} ausgewählt
            {visibleContacts.length !== contacts.length &&
              ` / ${visibleContacts.length} angezeigt`}
            )
          </h3>
          {visibleContacts.length > 0 && (
            <button
              type="button"
              onClick={toggleAllVisible}
              className="text-sm text-accent hover:text-accent-light transition-colors"
            >
              {allVisibleSelected ? "Auswahl zurücksetzen" : "Alle anzeigten auswählen"}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-bg-secondary/60 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-text-light">
            <Filter className="w-3.5 h-3.5" /> Filter
          </div>

          <div>
            <p className="text-xs text-text-light mb-1.5">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => {
                const active = statusFilter.has(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleStatus(s.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? `${STATUS_COLORS[s.value]} border-transparent`
                        : "bg-bg-card text-text-light border-border hover:text-text"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs text-text-light mb-1.5">Outreach Typ</p>
            <div className="flex gap-1.5">
              {(
                [
                  { value: "remote", label: "Remote", color: "bg-blue-100 text-blue-700" },
                  { value: "local", label: "Local (vor Ort)", color: "bg-orange-100 text-orange-700" },
                  { value: "all", label: "Beide", color: "bg-gray-200 text-gray-700" },
                ] as const
              ).map((opt) => {
                const active = outreachFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOutreachFilter(opt.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active ? `${opt.color} border-transparent` : "bg-bg-card text-text-light border-border hover:text-text"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Warning if local selected */}
        {counts.localSelected > 0 && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-lg p-3 text-xs">
            ⚠️ Du hast {counts.localSelected} Kontakt(e) mit Outreach-Typ <b>Local</b> ausgewählt — das sind welche, die ihr normalerweise <b>vor Ort besucht</b>. Sicher dass die eine Mail bekommen sollen?
          </div>
        )}

        {visibleContacts.length === 0 ? (
          <p className="text-sm text-text-light text-center py-6">
            {contacts.length === 0 ? (
              <>Keine Kontakte verfügbar. <Link href="/contacts/new" className="text-accent hover:underline">Kontakte anlegen</Link></>
            ) : (
              "Keine Kontakte passen zum aktuellen Filter."
            )}
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1 border border-border rounded-lg">
            {visibleContacts.map((contact) => (
              <label
                key={contact.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-bg-secondary cursor-pointer transition-colors border-b border-border last:border-0"
              >
                <input
                  type="checkbox"
                  checked={selectedContacts.has(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                  className="rounded border-border"
                />
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {contact.firstName} {contact.lastName}
                  </span>
                  <span className="text-xs text-text-light">{contact.email}</span>
                  {contact.company && (
                    <span className="text-xs text-text-light">· {contact.company}</span>
                  )}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      STATUS_COLORS[contact.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {STATUS_LABELS[contact.status] ?? contact.status}
                  </span>
                  {contact.outreach === "local" && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                      Local
                    </span>
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
