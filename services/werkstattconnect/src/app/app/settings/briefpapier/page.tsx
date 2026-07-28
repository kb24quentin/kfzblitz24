import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Palette } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireWorkshopUser } from "@/lib/admin-guard";
import { WorkshopShell } from "../../shell";
import { TEMPLATES } from "@/lib/pdf/types";
import { BriefpapierEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function BriefpapierPage() {
  const ctx = await requireWorkshopUser();
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/app");
  const w = await prisma.workshop.findUnique({ where: { id: ctx.workshopId } });
  if (!w) return null;

  const logoDataUrl =
    w.letterheadLogo && w.letterheadLogoMime
      ? `data:${w.letterheadLogoMime};base64,${Buffer.from(w.letterheadLogo).toString("base64")}`
      : null;

  return (
    <WorkshopShell current="settings">
      <div className="mb-4">
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück zu Einstellungen
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mt-1">
          <Palette className="w-6 h-6 text-orange-600" />
          Briefpapier
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Live-Vorschau — jede Änderung sofort sichtbar. Änderungen werden erst beim „Speichern" persistiert.
        </p>
      </div>

      <BriefpapierEditor
        templates={TEMPLATES}
        initial={{
          letterheadTemplate: w.letterheadTemplate,
          brandPrimary: w.brandPrimary ?? "#fe6503",
          brandAccent: w.brandAccent ?? "",
          brandFooterText: w.brandFooterText ?? "",
          footerCol1: w.footerCol1 ?? "",
          footerCol2: w.footerCol2 ?? "",
          footerCol3: w.footerCol3 ?? "",
        }}
        logoDataUrl={logoDataUrl}
        workshopName={w.name}
      />
    </WorkshopShell>
  );
}
