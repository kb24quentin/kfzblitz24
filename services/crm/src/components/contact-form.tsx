"use client";

import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

type ContactData = {
  id?: string;
  salutation?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string | null;
  position?: string | null;
  phone?: string | null;
  city?: string | null;
  notes?: string | null;
  status?: string;
  tags?: string;
  priority?: string;
  source?: string;
  outreach?: string;
  assignedToId?: string | null;
};

type UserOption = { id: string; name: string };

export function ContactForm({
  action,
  contact,
  users,
}: {
  action: (formData: FormData) => Promise<void>;
  contact?: ContactData;
  users?: UserOption[];
}) {
  const tags = contact?.tags ? JSON.parse(contact.tags).join(", ") : "";

  return (
    <form action={action} className="space-y-6">
      {contact?.id && <input type="hidden" name="id" value={contact.id} />}

      <div className="bg-bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="grid grid-cols-[140px_1fr_1fr] gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Anrede *</label>
            <select
              name="salutation"
              required
              defaultValue={contact?.salutation || ""}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="" disabled>— wählen —</option>
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Vorname *</label>
            <input
              name="firstName"
              required
              defaultValue={contact?.firstName}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              placeholder="Max"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Nachname *</label>
            <input
              name="lastName"
              required
              defaultValue={contact?.lastName}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              placeholder="Mustermann"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Email *</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={contact?.email}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            placeholder="max@firma.de"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Firma</label>
            <input
              name="company"
              defaultValue={contact?.company || ""}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              placeholder="Autohaus Mueller"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Position</label>
            <input
              name="position"
              defaultValue={contact?.position || ""}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              placeholder="Geschaeftsfuehrer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Telefon</label>
            <input
              name="phone"
              defaultValue={contact?.phone || ""}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              placeholder="+49 89 123456"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Stadt</label>
            <input
              name="city"
              defaultValue={contact?.city || ""}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              placeholder="Muenchen"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Outreach Typ *</label>
          <select
            name="outreach"
            defaultValue={contact?.outreach || "remote"}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="remote">Remote — Mail-Outreach</option>
            <option value="local">Local — vor Ort besuchen (kein Mail-Versand)</option>
          </select>
          <p className="text-xs text-text-light mt-1">
            &quot;Local&quot; werden in Kampagnen standardmäßig ausgeschlossen damit sie keine Mails bekommen.
          </p>
        </div>

        {contact?.id && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Status</label>
              <select
                name="status"
                defaultValue={contact.status}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="new">Neu</option>
                <option value="contacted">Kontaktiert</option>
                <option value="replied">Geantwortet</option>
                <option value="interested">Interessiert</option>
                <option value="not_interested">Kein Interesse</option>
                <option value="customer">Kunde</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Prioritaet</label>
              <select
                name="priority"
                defaultValue={contact.priority || "medium"}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Quelle</label>
              <select
                name="source"
                defaultValue={contact.source || "manual"}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="manual">Manuell</option>
                <option value="import">Import</option>
                <option value="website">Website</option>
              </select>
            </div>
          </div>
        )}

        {users && users.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text mb-1">Zugewiesen an</label>
            <select
              name="assignedToId"
              defaultValue={contact?.assignedToId || ""}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="">— Nicht zugewiesen —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text mb-1">Tags</label>
          <input
            name="tags"
            defaultValue={tags}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            placeholder="autohaus, muenchen, premium (kommagetrennt)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Notizen</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={contact?.notes || ""}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
            placeholder="Interne Notizen..."
          />
        </div>
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
          href={contact?.id ? `/contacts/${contact.id}` : "/contacts"}
          className="flex items-center gap-2 px-5 py-2.5 bg-bg-card border border-border text-text rounded-lg text-sm font-medium hover:bg-bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
