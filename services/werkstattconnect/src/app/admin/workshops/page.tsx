import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireKbAdmin } from "@/lib/admin-guard";
import { AdminShell } from "../shell";
import { Plus, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkshopsPage() {
  await requireKbAdmin();
  const workshops = await prisma.workshop.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <AdminShell current="workshops">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Werkstätten</h1>
          <p className="text-sm text-slate-500 mt-1">
            {workshops.length} {workshops.length === 1 ? "Werkstatt" : "Werkstätten"} insgesamt
          </p>
        </div>
        <Link
          href="/admin/workshops/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition"
        >
          <Plus className="w-4 h-4" />
          Neue Werkstatt
        </Link>
      </div>

      {workshops.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center">
          <p className="text-sm text-slate-500 mb-4">Noch keine Werkstatt angelegt.</p>
          <Link
            href="/admin/workshops/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Erste Werkstatt anlegen
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Werkstatt</th>
                <th className="text-left px-4 py-3 font-medium">Ort</th>
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-left px-4 py-3 font-medium">Team</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Angelegt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workshops.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <Link href={`/admin/workshops/${w.id}`} className="font-semibold text-slate-900 hover:text-orange-600">
                      {w.name}
                    </Link>
                    <div className="text-xs text-slate-500">{w.contactEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {w.city || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <PlanBadge plan={w.plan} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {w._count.users}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {w.active ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        aktiv
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        deaktiviert
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {w.createdAt.toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    free: { label: "Free", cls: "bg-slate-100 text-slate-700" },
    pro: { label: "Pro", cls: "bg-orange-50 text-orange-700" },
  };
  const c = config[plan] ?? { label: plan, cls: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.cls}`}>
      {c.label}
    </span>
  );
}
