import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Wrench } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkshopHome() {
  const session = await auth();
  const workshopId = (session?.user as { workshopId?: string } | undefined)?.workshopId ?? null;
  const workshop = workshopId
    ? await prisma.workshop.findUnique({ where: { id: workshopId } })
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/werkstattconnect-logo.svg"
              alt="WerkstattConnect"
              className="h-8 w-auto"
            />
            <span className="text-sm text-slate-400">|</span>
            <span className="text-sm font-semibold text-slate-900">
              {workshop?.name ?? "Werkstatt"}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-900">{session?.user?.email}</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-7 h-7 text-orange-600" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Willkommen bei WerkstattConnect
          </h1>
          <p className="text-sm text-slate-600">
            Phase-1-Scaffold. In Phase 2–6 kommen Kunden, Fahrzeuge, Kalender, Angebote und
            Rechnungen. Aktueller Plan: <strong className="text-slate-900">{workshop?.plan ?? "free"}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
