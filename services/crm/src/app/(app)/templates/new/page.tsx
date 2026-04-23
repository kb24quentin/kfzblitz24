export const dynamic = "force-dynamic";
import { TemplateEditor } from "@/components/template-editor";
import { createTemplate } from "../actions";

export default function NewTemplatePage() {
  return (
    <div className="max-w-5xl">
      <h2 className="text-lg font-bold text-text mb-6">Neues Template erstellen</h2>
      <TemplateEditor action={createTemplate} />
    </div>
  );
}
