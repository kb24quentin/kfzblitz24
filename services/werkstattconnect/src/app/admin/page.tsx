import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Wrench, Users, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await auth();
  const [workshopCount, activeAdmins] = await Promise.all([
    prisma.workshop.count(),
    prisma.kbAdmin.count({ where: { active: true } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black">
              <span className="text-slate-900">W</span>
              <span className="text-orange-600">C</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-semibold text-slate-900">KB24-Admin</span>
          </div>
          <div className="text-xs text-slate-500">
            Angemeldet als <span className="font-medium text-slate-900">{session?.user?.email}</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Admin-Übersicht</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Stat icon={<Wrench className="w-5 h-5" />} label="Werkstätten" value={workshopCount} />
          <Stat icon={<Users className="w-5 h-5" />} label="KB24-Admins aktiv" value={activeAdmins} />
          <Stat icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />} label="System" value="OK" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Nächste Schritte</h2>
          <p className="text-sm text-slate-600 mb-4">
            Phase-1-Scaffold ist deployed. In den nächsten Phasen kommen: Werkstatt anlegen (KB24-Admin) →
            Werkstatt-Mitarbeiter-CRUD → Kunden + Fahrzeuge → Kalender + Reminder → Angebote/Rechnungen.
          </p>
          <a
            href="/api/health"
            className="text-xs text-orange-600 hover:underline"
          >
            /api/health
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
        <span className="uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}
