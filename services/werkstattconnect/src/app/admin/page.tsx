import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireKbAdmin } from "@/lib/admin-guard";
import { AdminShell } from "./shell";
import { Wrench, Users, ShieldCheck, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireKbAdmin();
  const [workshopCount, activeAdmins, workshopUserCount, pendingAdmins] = await Promise.all([
    prisma.workshop.count(),
    prisma.kbAdmin.count({ where: { active: true } }),
    prisma.workshopUser.count(),
    prisma.kbAdmin.count({ where: { active: false } }),
  ]);

  return (
    <AdminShell current="home">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Übersicht</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Stat icon={<Wrench className="w-5 h-5" />} label="Werkstätten" value={workshopCount} />
        <Stat icon={<Users className="w-5 h-5" />} label="Werkstatt-User" value={workshopUserCount} />
        <Stat
          icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
          label="KB24-Admins aktiv"
          value={activeAdmins}
        />
        <Stat
          icon={<ShieldCheck className="w-5 h-5 text-amber-600" />}
          label="Pending-Admins"
          value={pendingAdmins}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Schnellaktion</h2>
          <p className="text-sm text-slate-600 mb-4">
            Neue Werkstatt anlegen — der Owner bekommt automatisch eine Setup-Mail und legt sein
            Passwort selbst fest.
          </p>
          <Link
            href="/admin/workshops/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
          >
            <Plus className="w-4 h-4" />
            Neue Werkstatt
          </Link>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Roadmap</h2>
          <ul className="text-sm text-slate-600 space-y-1.5">
            <li>Phase 2 (aktuell): Werkstatt-CRUD + Team-Management</li>
            <li className="text-slate-400">Phase 3: Kunden + Fahrzeuge</li>
            <li className="text-slate-400">Phase 4: Kalender + Reminder</li>
            <li className="text-slate-400">Phase 5: Rechnungen + GoBD</li>
          </ul>
        </div>
      </div>
    </AdminShell>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
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
