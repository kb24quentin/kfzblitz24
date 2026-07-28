import Link from "next/link";
import {
  Wrench,
  Users,
  FileText,
  CalendarClock,
  BellRing,
  Package,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <WcLogo />
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition"
            >
              Werkstatt-Login
            </Link>
            <Link
              href="/admin/login"
              className="px-4 py-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition text-xs"
            >
              KB24-Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
          Digitales Werkstatt-Management,
          <br />
          <span className="text-orange-600">verbunden mit kfzBlitz24.</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
          WerkstattConnect bündelt Kunden, Fahrzeuge, Aufträge, Angebote und Rechnungen
          in einer Software — mit direkter Anbindung an über 1 Million Ersatzteile bei
          kfzBlitz24.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition"
          >
            Zum Werkstatt-Login <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="mailto:info@kfzblitz24.de?subject=WerkstattConnect%20Zugang%20anfragen"
            className="inline-flex items-center gap-2 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            Werkstatt-Zugang anfragen
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Feature
            icon={<Users className="w-6 h-6" />}
            title="Kunden & Fahrzeuge"
            body="Kundendaten und Fahrzeuge (Kennzeichen, HSN/TSN, VIN) zentral verwalten. Volltextsuche über alles."
          />
          <Feature
            icon={<CalendarClock className="w-6 h-6" />}
            title="Auftrags-Kalender"
            body="Termine, Ressourcen-Planung, welcher Mechaniker macht was wann. Klarer Überblick über die Werkstattauslastung."
          />
          <Feature
            icon={<FileText className="w-6 h-6" />}
            title="Angebote & Rechnungen"
            body="Aus vordefinierten Services zusammenklicken, PDF im eigenen Briefpapier — GoBD-konform mit Journal und Nummernkreisen."
          />
          <Feature
            icon={<Package className="w-6 h-6" />}
            title="Teile direkt bei kfzBlitz24"
            body="Passende Teile für das Fahrzeug des Kunden finden und direkt aus WerkstattConnect bestellen."
          />
          <Feature
            icon={<BellRing className="w-6 h-6" />}
            title="Kunden-Erinnerungen"
            body="Automatische Reminder für TÜV, Öl-Wechsel, Bremsflüssigkeit — Kundenbindung ohne Extra-Aufwand."
          />
          <Feature
            icon={<Wrench className="w-6 h-6" />}
            title="Digitales Wartungsheft"
            body="Alle Arbeiten pro Fahrzeug chronologisch — als PDF für den Kunden druckbar (z.B. beim Verkauf)."
          />
        </div>
      </section>

      {/* Trust bar */}
      <section className="max-w-6xl mx-auto px-6 py-8 border-t border-slate-200">
        <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          GoBD-konform · DSGVO · gehostet in Deutschland
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} kfzBlitz24 GmbH · WerkstattConnect</div>
          <div className="flex items-center gap-4">
            <a href="https://kfzblitz24.de/impressum" className="hover:text-slate-800">
              Impressum
            </a>
            <a href="https://kfzblitz24.de/datenschutz" className="hover:text-slate-800">
              Datenschutz
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-orange-300 hover:shadow-sm transition">
      <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
        {icon}
      </div>
      <div className="font-semibold text-slate-900 mb-1">{title}</div>
      <div className="text-sm text-slate-600 leading-relaxed">{body}</div>
    </div>
  );
}

function WcLogo() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xl font-black tracking-tight">
        <span className="text-slate-900">W</span>
        <span className="text-orange-600">C</span>
      </span>
      <span className="hidden sm:inline w-px h-6 bg-slate-300" />
      <span className="hidden sm:inline text-sm font-semibold text-slate-900">
        Werkstatt<span className="text-orange-600">Connect</span>
      </span>
    </div>
  );
}
