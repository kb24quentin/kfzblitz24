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
  const [template, signatures, letterSignatures] = await Promise.all([
    prisma.template.findUnique({ where: { id } }),
    prisma.signature.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, html: true },
    }),
    prisma.letterSignature.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, imageData: true },
    }),
  ]);
  if (!template) notFound();

  return (
    <div className="max-w-5xl">
      <h2 className="text-lg font-bold text-text mb-6">Template bearbeiten</h2>
      <TemplateEditor
        action={updateTemplate}
        template={template}
        signatures={signatures}
        letterSignatures={letterSignatures}
      />
    </div>
  );
}
