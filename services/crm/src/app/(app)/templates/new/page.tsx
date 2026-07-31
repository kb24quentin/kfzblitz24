export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { TemplateEditor } from "@/components/template-editor";
import { createTemplate } from "../actions";

export default async function NewTemplatePage() {
  const [signatures, letterSignatures] = await Promise.all([
    prisma.signature.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, html: true },
    }),
    prisma.letterSignature.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, imageData: true },
    }),
  ]);

  return (
    <div className="max-w-5xl">
      <h2 className="text-lg font-bold text-text mb-6">Neues Template erstellen</h2>
      <TemplateEditor
        action={createTemplate}
        signatures={signatures}
        letterSignatures={letterSignatures}
      />
    </div>
  );
}
