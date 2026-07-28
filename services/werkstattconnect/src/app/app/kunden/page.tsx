import Link from "next/link";
import { Plus, UserRound, Car } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { customerDisplayName } from "@/lib/customer-name";
import { WorkshopShell } from "../shell";

export const dynamic = "force-dynamic";

export default async function KundenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireWorkshopUser();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const customers = await prisma.customer.findMany({
    where: {
      workshopId: ctx.workshopId,
      ...(query
        ? {
            OR: [
              { companyName: { contains: query, mode: "insensitive" } },
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { vehicles: { some: { licensePlate: { contains: query, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { vehicles: true } } },
    orderBy: [{ lastName: "asc" }, { companyName: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <WorkshopShell current="kunden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kunden</h1>
          <p className="text-sm text-slate-500 mt-1">
            {customers.length} {customers.length === 1 ? "Kunde" : "Kunden"}
            {query && ` · Suche: „${query}"`}
          </p>
        </div>
        <Link
          href="/app/kunden/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Neuer Kunde
        </Link>
      </div>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Suche nach Name, Firma, Email, Telefon, Kennzeichen…"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        />
      </form>

      {customers.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center">
          <UserRound className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4">
            {query ? "Kein Kunde gefunden." : "Noch keine Kunden angelegt."}
          </p>
          {!query && (
            <Link
              href="/app/kunden/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Ersten Kunden anlegen
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Kunde</th>
                <th className="text-left px-4 py-3 font-medium">Typ</th>
                <th className="text-left px-4 py-3 font-medium">Kontakt</th>
                <th className="text-left px-4 py-3 font-medium">Ort</th>
                <th className="text-left px-4 py-3 font-medium">Fahrzeuge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <Link href={`/app/kunden/${c.id}`} className="font-semibold text-slate-900 hover:text-orange-600">
                      {customerDisplayName(c)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        c.type === "b2b" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {c.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div className="text-slate-500">{c.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {c.zip && c.city ? `${c.zip} ${c.city}` : c.city || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Car className="w-3.5 h-3.5" />
                      {c._count.vehicles}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WorkshopShell>
  );
}
