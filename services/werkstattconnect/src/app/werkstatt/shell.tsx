import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LogOut, Home, Building2 } from "lucide-react";
import { signOutWorkshopAction } from "../actions/auth";

/**
 * Mechaniker-Shell — mobile/tablet-first. Grosse touch-targets, dunkles theme.
 */
export async function WerkstattShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const u = session?.user as
    | { id?: string; email?: string | null; workshopId?: string | null; role?: string | null }
    | undefined;
  const [workshop, currentUser] = await Promise.all([
    u?.workshopId
      ? prisma.workshop.findUnique({ where: { id: u.workshopId }, select: { name: true } })
      : null,
    u?.id ? prisma.workshopUser.findUnique({ where: { id: u.id }, select: { name: true } }) : null,
  ]);
  const displayName = currentUser?.name || u?.email?.split("@")[0] || "Mechaniker";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/werkstatt" className="flex items-center gap-2">
              <img src="/werkstattconnect-logo.svg" alt="WerkstattConnect" className="h-8 w-auto brightness-200 contrast-125" />
              <span className="hidden sm:inline text-xs uppercase tracking-wider bg-orange-600 text-white px-2 py-0.5 rounded font-bold">
                Werkstatt
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-white leading-tight">{displayName}</div>
              <div className="text-xs text-slate-400 leading-tight flex items-center gap-1 justify-end">
                <Building2 className="w-3 h-3" />
                {workshop?.name}
              </div>
            </div>
            <Link
              href="/app"
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-700 rounded-lg text-xs text-slate-300 hover:bg-slate-800"
              title="Zum Büro-Modus"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Büro</span>
            </Link>
            <form action={signOutWorkshopAction}>
              <button
                type="submit"
                className="p-1.5 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800"
                title="Abmelden"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
