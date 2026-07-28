import { redirect } from "next/navigation";
import { ListTree, Plus, Trash2, Edit3, Wrench, Package, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { formatEur } from "@/lib/money";
import { WorkshopShell } from "../shell";
import {
  createServiceItemAction,
  updateServiceItemAction,
  deleteServiceItemAction,
  seedStandardCatalogAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const ctx = await requireWorkshopUser();
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/app");

  const [items, workshop] = await Promise.all([
    prisma.serviceItem.findMany({
      where: { workshopId: ctx.workshopId },
      orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
    }),
    prisma.workshop.findUnique({
      where: { id: ctx.workshopId },
      select: { hourlyRateCent: true, partsMarkupPercent: true },
    }),
  ]);

  const hourlyRateCent = workshop?.hourlyRateCent ?? 9500;

  const grouped = new Map<string, typeof items>();
  for (const it of items) {
    const cat = it.category ?? "Sonstige";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(it);
  }

  return (
    <WorkshopShell current="services">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ListTree className="w-6 h-6 text-orange-600" />
            Leistungskatalog
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Stundenbasierte Leistungen werden mit deinem Stundensatz ({formatEur(hourlyRateCent)}/Std) verrechnet.
          </p>
        </div>
        <form action={seedStandardCatalogAction}>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800">
            <Sparkles className="w-4 h-4" />
            Standard-Katalog nachladen
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {items.length === 0 ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center">
              <ListTree className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-4">Noch keine Leistungen angelegt.</p>
              <form action={seedStandardCatalogAction}>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold">
                  <Sparkles className="w-4 h-4" />
                  Standard-Kfz-Katalog importieren
                </button>
              </form>
              <p className="text-xs text-slate-400 mt-3">
                Über 50 typische Kfz-Arbeiten mit realistischen Stundenwerten (Ölwechsel, Bremsen, HU, …)
              </p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([cat, list]) => (
              <section key={cat} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <header className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {cat} <span className="text-slate-400 font-normal">({list.length})</span>
                  </h2>
                </header>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {list.map((it) => (
                      <tr key={it.id} className={it.active ? "" : "opacity-50"}>
                        <td className="px-4 py-3">
                          <details>
                            <summary className="cursor-pointer list-none flex items-center gap-2">
                              <Edit3 className="w-3 h-3 text-slate-300" />
                              {it.laborHours ? (
                                <Wrench className="w-3.5 h-3.5 text-blue-500" />
                              ) : (
                                <Package className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                              <span className="font-medium text-slate-900">{it.name}</span>
                              {it.description && !it.active && (
                                <span className="text-xs text-slate-400 ml-2">— {it.description}</span>
                              )}
                            </summary>
                            <form action={updateServiceItemAction} className="mt-3 pl-5 space-y-2">
                              <input type="hidden" name="id" value={it.id} />
                              <div className="grid grid-cols-4 gap-2">
                                <input name="name" defaultValue={it.name} className="col-span-3 px-2 py-1 border border-slate-300 rounded text-xs" />
                                <input name="category" defaultValue={it.category ?? ""} placeholder="Kategorie" className="px-2 py-1 border border-slate-300 rounded text-xs" />
                              </div>
                              <textarea name="description" defaultValue={it.description ?? ""} rows={2} placeholder="Beschreibung" className="w-full px-2 py-1 border border-slate-300 rounded text-xs" />
                              <div className="grid grid-cols-4 gap-2">
                                <input name="laborHours" defaultValue={it.laborHours ?? ""} placeholder="Std (leer=Preis)" className="px-2 py-1 border border-slate-300 rounded text-xs" />
                                <input name="netPrice" defaultValue={(it.netPriceCent / 100).toFixed(2)} placeholder="Netto €" className="px-2 py-1 border border-slate-300 rounded text-xs" />
                                <select name="vatPercent" defaultValue={it.vatPercent} className="px-2 py-1 border border-slate-300 rounded text-xs">
                                  <option value="19">19 %</option>
                                  <option value="7">7 %</option>
                                </select>
                                <select name="unit" defaultValue={it.unit} className="px-2 py-1 border border-slate-300 rounded text-xs">
                                  <option value="Stk">Stk</option>
                                  <option value="Std">Std</option>
                                  <option value="Pauschal">Pauschal</option>
                                  <option value="l">l</option>
                                </select>
                              </div>
                              <label className="flex items-center gap-2 text-xs">
                                <input type="checkbox" name="active" defaultChecked={it.active} /> Aktiv
                              </label>
                              <button type="submit" className="px-3 py-1 bg-orange-600 text-white text-xs rounded font-semibold">Speichern</button>
                            </form>
                          </details>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs text-right w-24">
                          {it.laborHours ? `${it.laborHours} Std` : it.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums w-24">
                          {it.laborHours
                            ? formatEur(Math.round(it.laborHours * hourlyRateCent))
                            : formatEur(it.netPriceCent)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 text-xs w-14">{it.vatPercent} %</td>
                        <td className="px-4 py-3 text-right w-10">
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
              </section>
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Neue Leistung
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Stundenlohn-basiert: Std × Stundensatz. Fester Preis: direkter Netto-Betrag.
            </p>
            <form action={createServiceItemAction} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
                <input name="name" required placeholder="Ölwechsel mit Filter" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kategorie</label>
                <input name="category" placeholder="Wartung / Bremsen / …" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Beschreibung</label>
                <textarea name="description" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Arbeitsstunden (leer für festen Preis)</label>
                <input name="laborHours" placeholder="0,5" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Netto € (fester Preis)</label>
                  <input name="netPrice" defaultValue="0,00" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
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
                    <option value="l">l</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700">
                Leistung anlegen
              </button>
            </form>
          </div>
        </div>
      </div>
    </WorkshopShell>
  );
}
