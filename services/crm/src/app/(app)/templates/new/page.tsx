export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { TemplateEditor } from "@/components/template-editor";
import { createTemplate } from "../actions";

export default async function NewTemplatePage() {
  const signatures = await prisma.signature.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, html: true },
  });

  return (
    <div className="max-w-5xl">
      <h2 className="text-lg font-bold text-text mb-6">Neues Template erstellen</h2>
      <TemplateEditor action={createTemplate} signatures={signatures} />
    </div>
  );
}
