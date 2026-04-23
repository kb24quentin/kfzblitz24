"use client";

import Link from "next/link";
import { Edit, Trash2 } from "lucide-react";
import { deleteTemplate } from "./actions";

type Template = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string;
};

export function TemplateCard({ template }: { template: Template }) {
  const vars = JSON.parse(template.variables || "[]") as string[];
  const previewText = template.bodyHtml.replace(/<[^>]*>/g, " ").slice(0, 150);

  return (
    <div className="bg-bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-text">{template.name}</h3>
          <p className="text-sm text-text-light mt-0.5 truncate">{template.subject}</p>
        </div>
      </div>

      {vars.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {vars.map((v) => (
            <span
              key={v}
              className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full"
            >
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-text-light line-clamp-3 mb-4">{previewText}</p>

      <div className="flex items-center gap-1 pt-3 border-t border-border">
        <Link
          href={`/templates/${template.id}/edit`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text hover:bg-bg-secondary rounded-lg transition-colors"
        >
          <Edit className="w-3.5 h-3.5" /> Bearbeiten
        </Link>
        <form action={deleteTemplate} className="inline">
          <input type="hidden" name="id" value={template.id} />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-danger hover:bg-red-50 rounded-lg transition-colors"
            onClick={(e) => {
              if (!confirm("Template wirklich löschen?")) e.preventDefault();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Löschen
          </button>
        </form>
      </div>
    </div>
  );
}
