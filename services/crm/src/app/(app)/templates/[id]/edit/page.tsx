export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/template-editor";
import { updateTemplate } from "../../actions";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) notFound();

  return (
    <div className="max-w-5xl">
      <h2 className="text-lg font-bold text-text mb-6">Template bearbeiten</h2>
      <TemplateEditor action={updateTemplate} template={template} />
    </div>
  );
}
