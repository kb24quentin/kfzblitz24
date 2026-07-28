import { redirect } from "next/navigation";
import { Mail, Power, RefreshCw, UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { WorkshopShell } from "../shell";
import {
  inviteTeamMemberAction,
  resendTeamMemberSetupMailAction,
  toggleTeamMemberActiveAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireWorkshopUser();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    redirect("/app");
  }

  const users = await prisma.workshopUser.findMany({
    where: { workshopId: ctx.workshopId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return (
    <WorkshopShell current="team">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-1">
            {users.length} {users.length === 1 ? "Mitarbeiter" : "Mitarbeiter"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Rolle</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {!u.password ? (
                      <span className="text-amber-700">Setup ausstehend</span>
                    ) : u.active ? (
                      <span className="text-emerald-700">aktiv</span>
                    ) : (
                      <span className="text-slate-400">deaktiviert</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== "owner" && (
                      <div className="flex justify-end gap-2">
                        <form action={resendTeamMemberSetupMailAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-orange-600"
                            title={u.password ? "Passwort zurücksetzen" : "Setup-Mail erneut senden"}
                          >
                            {u.password ? (
                              <RefreshCw className="w-3.5 h-3.5" />
                            ) : (
                              <Mail className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </form>
                        <form action={toggleTeamMemberActiveAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                          <button
                            type="submit"
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs ${
                              u.active
                                ? "text-slate-600 hover:text-red-600"
                                : "text-emerald-600 hover:text-emerald-700"
                            }`}
                            title={u.active ? "Deaktivieren" : "Aktivieren"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Mitarbeiter einladen
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Bekommt automatisch eine Setup-Mail und legt sein Passwort selbst fest.
          </p>
          <form action={inviteTeamMemberAction} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
              <input
                name="name"
                required
                placeholder="Anna Schmidt"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                required
                placeholder="anna@werkstatt.de"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rolle</label>
              <select
                name="role"
                defaultValue="mitarbeiter"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              >
                <option value="mitarbeiter">Mitarbeiter</option>
                <option value="admin">Admin (kann Team verwalten)</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
            >
              <Mail className="w-4 h-4" />
              Einladen + Mail senden
            </button>
          </form>
        </div>
      </div>
    </WorkshopShell>
  );
}

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, string> = {
    owner: "bg-orange-50 text-orange-700",
    admin: "bg-indigo-50 text-indigo-700",
    mitarbeiter: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        config[role] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {role}
    </span>
  );
}
