export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Building2, User, MapPin, ChevronRight } from "lucide-react";
import { StatusBadge, ScoreBadge } from "@/components/status-badge";

const FILTERS = [
  { id: "all", label: "Alle" },
  { id: "pending", label: "Neu" },
  { id: "assessing", label: "Wird geprüft" },
  { id: "more_docs_needed", label: "Docs nachgefordert" },
  { id: "approved", label: "Freigegeben" },
  { id: "rejected", label: "Abgelehnt" },
];

export default async function CasesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "all";
  const q = (params.q ?? "").trim();

  const where: Prisma.B2BCaseWhereInput = {};
  if (status !== "all") where.status = status;
  if (q) {
    where.OR = [
      { companyName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { contactLastName: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }

  const cases = await prisma.b2BCase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const counts = await prisma.b2BCase.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countByStatus: Record<string, number> = {};
  for (const c of counts) countByStatus[c.status] = c._count._all;
  const total = Object.values(countByStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">B2B-Anfragen</h1>
          <p className="text-sm text-text-light">
            Neue Kunden werden automatisch geprüft. Du entscheidest am Ende manuell — oder lässt die
            Engine entscheiden.
          </p>
        </div>
        <form className="flex items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Firma, Mail, Stadt..."
            className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 w-64"
          />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <button
            type="submit"
            className="px-3 py-2 bg-bg-card border border-border text-text rounded-lg text-sm hover:bg-bg-secondary"
          >
            Suchen
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => {
          const active = (f.id === "all" && status === "all") || f.id === status;
          const count = f.id === "all" ? total : countByStatus[f.id] ?? 0;
          const href =
            f.id === "all"
              ? "/" + (q ? `?q=${encodeURIComponent(q)}` : "")
              : `/?status=${f.id}` + (q ? `&q=${encodeURIComponent(q)}` : "");
          return (
            <Link
              key={f.id}
              href={href}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? "bg-primary text-white border-primary"
                  : "bg-bg-card border-border text-text-light hover:text-text hover:bg-bg-secondary"
              }`}
            >
              {f.label}{" "}
              <span className={`ml-1 text-xs ${active ? "opacity-80" : "opacity-60"}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {cases.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-border p-10 text-center">
          <p className="text-sm text-text-light mb-4">Noch keine Cases vorhanden.</p>
          <Link
            href="/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light"
          >
            Ersten Case anlegen
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="flex items-center gap-4 bg-bg-card rounded-xl border border-border px-4 py-3 hover:bg-bg-secondary/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text">
                      {c.companyName}
                    </span>
                    <span className="text-xs text-text-light">
                      ({customerTypeLabel(c.customerType, c.businessSubtype)})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-light mt-0.5 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {c.contactFirstName} {c.contactLastName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {c.postalCode} {c.city}
                    </span>
                    <span>·</span>
                    <span className="font-mono">{c.email}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={c.status} />
                  <ScoreBadge score={c.score} />
                </div>
                <ChevronRight className="w-4 h-4 text-text-light shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function customerTypeLabel(type: string, sub: string | null): string {
  const subLabels: Record<string, string> = {
    kfz_werkstatt: "Kfz-Werkstatt",
    reifenservice: "Reifenservice",
    karosseriebau: "Karosseriebau",
    onlineshop: "Online-Shop",
    grosshandel: "Großhandel",
    einzelhandel: "Einzelhandel",
  };
  if (sub && subLabels[sub]) return subLabels[sub];
  return type === "werkstatt" ? "Werkstatt" : type === "wiederverkaeufer" ? "Wiederverkäufer" : type;
}
