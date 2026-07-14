import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TemplateForm } from "@/components/template-form";
import { updateTemplateAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) notFound();

  const bound = async (formData: FormData) => {
    "use server";
    await updateTemplateAction(id, formData);
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-text mb-4">Template bearbeiten</h1>
      <TemplateForm
        initial={{
          name: template.name,
          shortcode: template.shortcode || "",
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          category: template.category || "",
        }}
        action={bound}
        submitLabel="Speichern"
      />
    </div>
  );
}
