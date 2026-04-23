import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, Upload, Search, Filter } from "lucide-react";
import { ContactsTable } from "./contacts-table";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search || "";
  const statusFilter = params.status || "";
  const page = parseInt(params.page || "1");
  const perPage = 25;

  const where = {
    ...(search && {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } },
      ],
    }),
    ...(statusFilter && { status: statusFilter }),
  };

  const [contacts, totalCount] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.contact.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <form className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
            <input
              name="search"
              type="text"
              placeholder="Kontakte suchen..."
              defaultValue={search}
              className="pl-9 pr-4 py-2 bg-bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 w-72"
            />
          </form>
          <select
            name="status"
            defaultValue={statusFilter}
            className="py-2 px-3 bg-bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="">Alle Status</option>
            <option value="new">Neu</option>
            <option value="contacted">Kontaktiert</option>
            <option value="replied">Geantwortet</option>
            <option value="interested">Interessiert</option>
            <option value="not_interested">Kein Interesse</option>
            <option value="customer">Kunde</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/contacts/import"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <Link
            href="/contacts/new"
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neuer Kontakt
          </Link>
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-text-light">
        {totalCount} Kontakt{totalCount !== 1 ? "e" : ""} gefunden
      </p>

      {/* Table */}
      <ContactsTable contacts={contacts} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/contacts?page=${p}${search ? `&search=${search}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? "bg-accent text-white"
                  : "bg-bg-card border border-border hover:bg-bg-secondary"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
