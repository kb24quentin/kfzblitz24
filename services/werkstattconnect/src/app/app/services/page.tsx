import { redirect } from "next/navigation";
import { ListTree, Plus, Trash2, Edit3 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { formatEur } from "@/lib/money";
import { WorkshopShell } from "../shell";
import {
  createServiceItemAction,
  updateServiceItemAction,
  deleteServiceItemAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const ctx = await requireWorkshopUser();
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/app");

  const items = await prisma.serviceItem.findMany({
    where: { workshopId: ctx.workshopId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <WorkshopShell current="services">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ListTree className="w-6 h-6 text-orange-600" />
          Leistungen
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Vordefinierte Positionen für schnelle Rechnungserstellung (Ölwechsel, HU, Räderwechsel…).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {items.length === 0 ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center">
              <ListTree className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Noch keine Leistung angelegt.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Einheit</th>
                    <th className="text-right px-4 py-3 font-medium">Preis (netto)</th>
                    <th className="text-right px-4 py-3 font-medium">MwSt</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.id} className={it.active ? "" : "opacity-50"}>
                      <td className="px-4 py-3">
                        <details>
                          <summary className="cursor-pointer list-none flex items-center gap-2">
                            <Edit3 className="w-3 h-3 text-slate-300" />
                            <span className="font-medium text-slate-900">{it.name}</span>
                          </summary>
                          <form action={updateServiceItemAction} className="mt-3 pl-5 space-y-2">
                            <input type="hidden" name="id" value={it.id} />
                            <input name="name" defaultValue={it.name} className="w-full px-2 py-1 border border-slate-300 rounded text-xs" />
                            <textarea name="description" defaultValue={it.description ?? ""} rows={2} placeholder="Beschreibung" className="w-full px-2 py-1 border border-slate-300 rounded text-xs" />
                            <div className="grid grid-cols-3 gap-2">
                              <input name="netPrice" defaultValue={(it.netPriceCent / 100).toFixed(2)} placeholder="Netto €" className="px-2 py-1 border border-slate-300 rounded text-xs" />
                              <select name="vatPercent" defaultValue={it.vatPercent} className="px-2 py-1 border border-slate-300 rounded text-xs">
                                <option value="19">19 %</option>
                                <option value="7">7 %</option>
                              </select>
                              <select name="unit" defaultValue={it.unit} className="px-2 py-1 border border-slate-300 rounded text-xs">
                                <option value="Stk">Stk</option>
                                <option value="Std">Std</option>
                                <option value="Pauschal">Pauschal</option>
                              </select>
                            </div>
                            <label className="flex items-center gap-2 text-xs">
                              <input type="checkbox" name="active" defaultChecked={it.active} /> Aktiv
                            </label>
                            <div className="flex gap-2">
                              <button type="submit" className="px-3 py-1 bg-orange-600 text-white text-xs rounded font-semibold">Speichern</button>
                            </div>
                          </form>
                        </details>
                        {it.description && !it.active && (
                          <div className="text-xs text-slate-400 mt-1">{it.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{it.unit}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatEur(it.netPriceCent)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 text-xs">{it.vatPercent} %</td>
                      <td className="px-4 py-3 text-right">
                        <form action={deleteServiceItemAction}>
                          <input type="hidden" name="id" value={it.id} />
                          <button className="p-1 text-slate-400 hover:text-red-600" title="Löschen">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Neue Leistung
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Preise werden beim Nutzen in eine Rechnung als Snapshot eingefroren (GoBD).
          </p>
          <form action={createServiceItemAction} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
              <input name="name" required placeholder="Ölwechsel bis 5L" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Beschreibung</label>
              <textarea name="description" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Netto €</label>
                <input name="netPrice" defaultValue="0,00" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">MwSt</label>
                <select name="vatPercent" defaultValue="19" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="19">19 %</option>
                  <option value="7">7 %</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Einheit</label>
                <select name="unit" defaultValue="Stk" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="Stk">Stk</option>
                  <option value="Std">Std</option>
                  <option value="Pauschal">Pauschal</option>
                </select>
              </div>
            </div>
            <button type="submit" className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
              Leistung anlegen
            </button>
          </form>
        </div>
      </div>
    </WorkshopShell>
  );
}
