import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Home,
  Users,
  UserRound,
  CalendarDays,
  Bell,
  FileText,
  FileCheck,
  Settings,
  ListTree,
} from "lucide-react";

type NavKey =
  | "home"
  | "kunden"
  | "kalender"
  | "reminders"
  | "angebote"
  | "rechnungen"
  | "services"
  | "team"
  | "settings";

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
    { key: "kunden", label: "Kunden", href: "/app/kunden", icon: <UserRound className="w-4 h-4" />, show: true },
    { key: "kalender", label: "Kalender", href: "/app/kalender", icon: <CalendarDays className="w-4 h-4" />, show: true },
    { key: "reminders", label: "Erinnerungen", href: "/app/reminders", icon: <Bell className="w-4 h-4" />, show: true },
    { key: "angebote", label: "Angebote", href: "/app/angebote", icon: <FileCheck className="w-4 h-4" />, show: true },
    { key: "rechnungen", label: "Rechnungen", href: "/app/rechnungen", icon: <FileText className="w-4 h-4" />, show: true },
    { key: "services", label: "Leistungen", href: "/app/services", icon: <ListTree className="w-4 h-4" />, show: isAdmin },
    { key: "team", label: "Team", href: "/app/team", icon: <Users className="w-4 h-4" />, show: isAdmin },
    { key: "settings", label: "Einstellungen", href: "/app/settings", icon: <Settings className="w-4 h-4" />, show: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
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
        <nav className="max-w-7xl mx-auto px-6 flex gap-1 -mb-px overflow-x-auto">
          {NAV.filter((n) => n.show).map((n) => {
            const active = n.key === current;
            return (
              <Link
                key={n.key}
                href={n.href}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
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
      <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
