import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Power, RefreshCw } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireKbAdmin } from "@/lib/admin-guard";
import { AdminShell } from "../../shell";
import {
  resendWorkshopUserSetupMailAction,
  toggleWorkshopActiveAction,
  updateWorkshopPlanAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function WorkshopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireKbAdmin();
  const { id } = await params;
  const workshop = await prisma.workshop.findUnique({
    where: { id },
    include: {
      users: { orderBy: [{ role: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!workshop) return notFound();

  return (
    <AdminShell current="workshops">
      <div className="mb-6">
        <Link
          href="/admin/workshops"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Alle Werkstätten
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{workshop.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              /{workshop.slug} · {workshop.contactEmail}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form action={toggleWorkshopActiveAction}>
              <input type="hidden" name="id" value={workshop.id} />
              <input type="hidden" name="active" value={workshop.active ? "false" : "true"} />
              <button
                type="submit"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  workshop.active
                    ? "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                {workshop.active ? "Deaktivieren" : "Aktivieren"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <InfoCard title="Adresse">
          {workshop.street ? (
            <>
              <div>{workshop.street}</div>
              <div>
                {workshop.zip} {workshop.city}
              </div>
            </>
          ) : (
            <span className="text-slate-400">Keine Adresse hinterlegt</span>
          )}
        </InfoCard>
        <InfoCard title="Kontakt">
          <div>{workshop.contactEmail}</div>
          {workshop.contactPhone && <div>{workshop.contactPhone}</div>}
        </InfoCard>
        <InfoCard title="USt-IdNr.">
          {workshop.taxId || <span className="text-slate-400">—</span>}
        </InfoCard>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Plan</h2>
        <form action={updateWorkshopPlanAction} className="flex items-center gap-3">
          <input type="hidden" name="id" value={workshop.id} />
          <select
            name="plan"
            defaultValue={workshop.plan}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          >
            <option value="free">Free</option>
            <option value="pro">Pro (kostenpflichtig)</option>
          </select>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
          >
            Plan ändern
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Team</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {workshop.users.length} {workshop.users.length === 1 ? "Mitarbeiter" : "Mitarbeiter"}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Werkstatt-Admins verwalten das Team selbst in ihrem eigenen Panel.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-6 py-3 font-medium">Name</th>
              <th className="text-left px-6 py-3 font-medium">Email</th>
              <th className="text-left px-6 py-3 font-medium">Rolle</th>
              <th className="text-left px-6 py-3 font-medium">Passwort</th>
              <th className="text-left px-6 py-3 font-medium">Status</th>
              <th className="text-left px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workshop.users.map((u) => (
              <tr key={u.id}>
                <td className="px-6 py-3 font-medium text-slate-900">{u.name}</td>
                <td className="px-6 py-3 text-slate-600">{u.email}</td>
                <td className="px-6 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-6 py-3 text-xs">
                  {u.password ? (
                    <span className="text-emerald-700">gesetzt</span>
                  ) : (
                    <span className="text-amber-700">Setup ausstehend</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  {u.active ? (
                    <span className="text-xs text-slate-600">aktiv</span>
                  ) : (
                    <span className="text-xs text-slate-400">deaktiviert</span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  <form action={resendWorkshopUserSetupMailAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-orange-600"
                      title="Neuer Setup-Link — bestehendes Passwort wird zurückgesetzt"
                    >
                      {u.password ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Passwort zurücksetzen
                        </>
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          Setup-Mail erneut senden
                        </>
                      )}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{title}</div>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
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
