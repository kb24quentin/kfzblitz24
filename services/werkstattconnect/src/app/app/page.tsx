import Link from "next/link";
import { UserRound, Car, CalendarDays, Bell, FileText, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WorkshopShell } from "./shell";
import { customerDisplayName } from "@/lib/customer-name";
import { formatEur } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function WorkshopHome() {
  const session = await auth();
  const u = session?.user as { workshopId?: string | null; role?: string | null } | undefined;
  const workshopId = u?.workshopId ?? null;

  const [workshop, teamCount, customerCount, vehicleCount, todaysAppointments, overdueReminders, openInvoices, mtdInvoices] =
    await Promise.all([
      workshopId ? prisma.workshop.findUnique({ where: { id: workshopId } }) : null,
      workshopId ? prisma.workshopUser.count({ where: { workshopId, active: true } }) : 0,
      workshopId ? prisma.customer.count({ where: { workshopId } }) : 0,
      workshopId ? prisma.vehicle.count({ where: { workshopId } }) : 0,
      workshopId
        ? prisma.appointment.findMany({
            where: {
              workshopId,
              startsAt: { gte: startOfDay(new Date()), lt: startOfDay(addDays(new Date(), 1)) },
              status: { not: "cancelled" },
            },
            include: { customer: true, vehicle: true, mechanic: { select: { name: true } } },
            orderBy: { startsAt: "asc" },
          })
        : [],
      workshopId
        ? prisma.reminder.count({
            where: { workshopId, status: "pending", dueDate: { lte: addDays(new Date(), 30) } },
          })
        : 0,
      workshopId
        ? prisma.invoice.count({ where: { workshopId, status: { in: ["sent"] } } })
        : 0,
      workshopId
        ? prisma.invoice.aggregate({
            where: {
              workshopId,
              issuedAt: { gte: startOfMonth(new Date()) },
              status: { not: "cancelled" },
            },
            _sum: { totalGrossCent: true },
          })
        : { _sum: { totalGrossCent: 0 } },
    ]);

  const mtdRevenue = mtdInvoices._sum.totalGrossCent ?? 0;

  return (
    <WorkshopShell current="home">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Willkommen bei {workshop?.name}</h1>
      <p className="text-sm text-slate-500 mb-6">
        Plan: <strong className="text-slate-900">{workshop?.plan ?? "free"}</strong>
        {" · "}Heute ist {new Date().toLocaleDateString("de-DE", { dateStyle: "full" })}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiCard icon={<UserRound className="w-4 h-4" />} label="Kunden" value={customerCount} href="/app/kunden" />
        <KpiCard icon={<Car className="w-4 h-4" />} label="Fahrzeuge" value={vehicleCount} />
        <KpiCard
          icon={<Bell className="w-4 h-4" />}
          label="Anst. Erinnerungen"
          value={overdueReminders}
          href="/app/reminders"
          highlight={overdueReminders > 0 ? "amber" : undefined}
        />
        <KpiCard
          icon={<FileText className="w-4 h-4" />}
          label="Offene Rechnungen"
          value={openInvoices}
          href="/app/rechnungen?status=sent"
          highlight={openInvoices > 0 ? "blue" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Termine heute
              </h2>
            </div>
            <Link href="/app/kalender" className="text-xs text-orange-600 hover:underline">Zum Kalender</Link>
          </header>
          {todaysAppointments.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Keine Termine heute.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todaysAppointments.map((a) => (
                <li key={a.id} className="p-4">
                  <Link href={`/app/kalender/${a.id}`} className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500">
                        {a.startsAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} –{" "}
                        {a.endsAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="font-medium text-slate-900 text-sm">{a.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {customerDisplayName(a.customer)}
                        {a.mechanic && ` · ${a.mechanic.name}`}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Umsatz-Monat</h2>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">{formatEur(mtdRevenue)}</div>
          <p className="text-xs text-slate-500 mt-1">
            Brutto seit {startOfMonth(new Date()).toLocaleDateString("de-DE", { day: "2-digit", month: "long" })}
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">Team aktiv</div>
            <div className="text-lg font-semibold text-slate-900">{teamCount}</div>
          </div>
        </section>
      </div>
    </WorkshopShell>
  );
}

function KpiCard({
  icon,
  label,
  value,
  href,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  href?: string;
  highlight?: "amber" | "blue";
}) {
  const cls = highlight === "amber"
    ? "border-amber-300 bg-amber-50"
    : highlight === "blue"
      ? "border-blue-300 bg-blue-50"
      : "border-slate-200 bg-white";
  const inner = (
    <>
      <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
        <span className="uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    </>
  );
  return href ? (
    <Link href={href} className={`block rounded-xl p-4 border hover:shadow-sm transition ${cls}`}>{inner}</Link>
  ) : (
    <div className={`rounded-xl p-4 border ${cls}`}>{inner}</div>
  );
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
