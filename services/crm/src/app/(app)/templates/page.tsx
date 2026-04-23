export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { TemplateCard } from "./template-card";

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-light">{templates.length} Template{templates.length !== 1 ? "s" : ""}</p>
        <Link
          href="/templates/new"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neues Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
          <FileText className="w-12 h-12 text-text-light/40 mx-auto mb-3" />
          <p className="font-medium text-text">Noch keine Templates</p>
          <p className="text-sm text-text-light mt-1">
            Erstelle ein Template mit Variablen fuer personalisierte Emails
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}
