import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createTicketAction } from "../[id]/actions";

export default function NewTicketPage() {
  return (
    <div className="max-w-2xl">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1 text-sm text-text-light hover:text-text mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Zurück
      </Link>

      <h1 className="text-xl font-bold text-text mb-1">Neues Ticket manuell erstellen</h1>
      <p className="text-sm text-text-light mb-6">
        Für Fälle die per Telefon oder anderweitig reinkommen. Bei Gmail-Sync
        werden Tickets automatisch angelegt.
      </p>

      <form action={createTicketAction} className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Kunden-Email *
            </label>
            <input
              type="email"
              name="contactEmail"
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Kunden-Name
            </label>
            <input
              type="text"
              name="contactName"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Betreff *</label>
          <input
            type="text"
            name="subject"
            required
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Priorität</label>
          <select
            name="priority"
            defaultValue="normal"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
          >
            <option value="low">Niedrig</option>
            <option value="normal">Normal</option>
            <option value="high">Hoch</option>
            <option value="urgent">Dringend</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Erste Nachricht (optional)
          </label>
          <textarea
            name="bodyHtml"
            rows={5}
            placeholder="Optionale erste ausgehende Nachricht (wird noch nicht per Mail versendet)"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
          <p className="text-xs text-text-light mt-1">
            Wird nur als Verlaufseintrag angelegt, nicht automatisch versendet.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Link
            href="/tickets"
            className="px-4 py-2 border border-border rounded-lg text-sm text-text-light hover:bg-bg-secondary transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-light transition-colors"
          >
            Ticket anlegen
          </button>
        </div>
      </form>
    </div>
  );
}
