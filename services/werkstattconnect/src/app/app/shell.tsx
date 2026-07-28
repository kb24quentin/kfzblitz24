import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Home, Users } from "lucide-react";

type NavKey = "home" | "team";

export async function WorkshopShell({
  current,
  children,
}: {
  current: NavKey;
  children: React.ReactNode;
}) {
  const session = await auth();
  const u = session?.user as
    | { email?: string | null; workshopId?: string | null; role?: string | null }
    | undefined;
  const workshop = u?.workshopId
    ? await prisma.workshop.findUnique({
        where: { id: u.workshopId },
        select: { name: true, plan: true },
      })
    : null;
  const isAdmin = u?.role === "owner" || u?.role === "admin";

  const NAV: { key: NavKey; label: string; href: string; icon: React.ReactNode; show: boolean }[] = [
    { key: "home", label: "Übersicht", href: "/app", icon: <Home className="w-4 h-4" />, show: true },
    { key: "team", label: "Team", href: "/app/team", icon: <Users className="w-4 h-4" />, show: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/app">
              <img
                src="/werkstattconnect-logo.svg"
                alt="WerkstattConnect"
                className="h-10 w-auto"
              />
            </Link>
            <span className="text-sm text-slate-400">|</span>
            <span className="text-sm font-semibold text-slate-900">
              {workshop?.name ?? "Werkstatt"}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-900">{u?.email}</span>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-6 flex gap-1 -mb-px">
          {NAV.filter((n) => n.show).map((n) => {
            const active = n.key === current;
            return (
              <Link
                key={n.key}
                href={n.href}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition ${
                  active
                    ? "border-orange-600 text-orange-700"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {n.icon}
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
