import Link from "next/link";
import { auth } from "@/lib/auth";
import { Home, Wrench, LogOut } from "lucide-react";
import { signOutAdminAction } from "../actions/auth";

type NavKey = "home" | "workshops";

const NAV: { key: NavKey; label: string; href: string; icon: React.ReactNode }[] = [
  { key: "home", label: "Übersicht", href: "/admin", icon: <Home className="w-4 h-4" /> },
  {
    key: "workshops",
    label: "Werkstätten",
    href: "/admin/workshops",
    icon: <Wrench className="w-4 h-4" />,
  },
];

export async function AdminShell({
  current,
  children,
}: {
  current: NavKey;
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <img
                src="/werkstattconnect-logo.svg"
                alt="WerkstattConnect"
                className="h-10 w-auto"
              />
            </Link>
            <span className="text-xs uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              KB24-Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 hidden sm:block">
              <span className="font-medium text-slate-900">{session?.user?.email}</span>
            </div>
            <form action={signOutAdminAction}>
              <button
                type="submit"
                title="Abmelden"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-300 rounded-lg transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </form>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-6 flex gap-1 -mb-px">
          {NAV.map((n) => {
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
