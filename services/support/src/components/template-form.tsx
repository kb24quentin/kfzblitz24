"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";

type Values = {
  name: string;
  subject: string;
  bodyHtml: string;
  category: string;
};

export function TemplateForm({
  initial,
  action,
  submitLabel,
}: {
  initial?: Partial<Values>;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml || "");

  return (
    <div className="max-w-3xl">
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 text-sm text-text-light hover:text-text mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Zurück
      </Link>

      <form action={action} className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Name *</label>
            <input
              name="name"
              required
              defaultValue={initial?.name}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Kategorie</label>
            <select
              name="category"
              defaultValue={initial?.category || ""}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
            >
              <option value="">— keine —</option>
              <option value="shipping">Versand</option>
              <option value="returns">Retoure</option>
              <option value="invoice">Rechnung</option>
              <option value="general">Allgemein</option>
              <option value="other">Sonstiges</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Betreff *</label>
          <input
            name="subject"
            required
            defaultValue={initial?.subject}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Body *{" "}
            <span className="text-xs text-text-light font-normal">
              — Variablen: {"{{customer.name}}, {{customer.email}}, {{ticket.number}}, {{order.id}}"}
            </span>
          </label>
          <input type="hidden" name="bodyHtml" value={bodyHtml} />
          <RichTextEditor value={bodyHtml} onChange={setBodyHtml} minHeight={200} />
        </div>

        <div className="flex justify-end gap-2">
          <Link
            href="/templates"
            className="px-4 py-2 border border-border rounded-lg text-sm text-text-light hover:bg-bg-secondary transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-light transition-colors"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
