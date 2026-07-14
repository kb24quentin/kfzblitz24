import Link from "next/link";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { deleteTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <FileText className="w-5 h-5" /> Antwort-Templates
          </h1>
          <p className="text-sm text-text-light mt-1">
            Bausteine für schnelle Antworten. Variablen im Format{" "}
            <span className="font-mono">{"{{customer.name}}"}</span>.
          </p>
        </div>
        <Link
          href="/templates/new"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Plus className="w-4 h-4" /> Neues Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-text-light mx-auto mb-3" />
          <h3 className="text-base font-semibold text-text mb-1">
            Noch keine Templates
          </h3>
          <p className="text-sm text-text-light">
            Lege häufige Antworten als Templates an — dann findest du sie im
            Antwort-Composer per Dropdown.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => {
            const vars: string[] = t.variables ? JSON.parse(t.variables) : [];
            return (
              <div key={t.id} className="bg-bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-text">{t.name}</h3>
                    {t.category && (
                      <span className="text-xs text-text-light">{t.category}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Link
                      href={`/templates/${t.id}/edit`}
                      className="p-1.5 text-text-light hover:text-text hover:bg-bg-secondary rounded"
                      title="Bearbeiten"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <form action={async () => { "use server"; await deleteTemplateAction(t.id); }}>
                      <button
                        type="submit"
                        className="p-1.5 text-text-light hover:text-danger hover:bg-danger/10 rounded"
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
                <div className="text-sm text-text-light mb-2 line-clamp-1">
                  {t.subject}
                </div>
                <div
                  className="text-sm text-text-light line-clamp-3 mb-3"
                  dangerouslySetInnerHTML={{ __html: t.bodyHtml }}
                />
                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {vars.map((v) => (
                      <span
                        key={v}
                        className="text-xs font-mono bg-bg-secondary text-text-light px-1.5 py-0.5 rounded"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
