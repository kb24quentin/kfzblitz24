import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WorkshopShell } from "./shell";
import { Wrench, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkshopHome() {
  const session = await auth();
  const u = session?.user as
    | { workshopId?: string | null; role?: string | null }
    | undefined;
  const workshopId = u?.workshopId ?? null;
  const [workshop, teamCount] = await Promise.all([
    workshopId ? prisma.workshop.findUnique({ where: { id: workshopId } }) : null,
    workshopId ? prisma.workshopUser.count({ where: { workshopId, active: true } }) : 0,
  ]);
  const isAdmin = u?.role === "owner" || u?.role === "admin";

  return (
    <WorkshopShell current="home">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">
        Willkommen bei {workshop?.name}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Plan: <strong className="text-slate-900">{workshop?.plan ?? "free"}</strong>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Stat icon={<Users className="w-5 h-5" />} label="Team" value={teamCount} />
        <Stat icon={<Wrench className="w-5 h-5" />} label="Aufträge (heute)" value="—" />
        <Stat icon={<Wrench className="w-5 h-5" />} label="Kunden" value="—" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Nächste Schritte</h2>
        <p className="text-sm text-slate-600 mb-4">
          {isAdmin
            ? `Als Werkstatt-Admin kannst du dein Team unter „Team" einladen. In den nächsten Phasen kommen Kunden, Fahrzeuge, Kalender, Angebote und Rechnungen.`
            : "Weitere Module (Kunden, Fahrzeuge, Kalender, Rechnungen) folgen in den nächsten Phasen."}
        </p>
        {isAdmin && (
          <Link
            href="/app/team"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
          >
            <Users className="w-3.5 h-3.5" />
            Team verwalten
          </Link>
        )}
      </div>
    </WorkshopShell>
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
