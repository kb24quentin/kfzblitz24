import { TemplateForm } from "@/components/template-form";
import { createTemplateAction } from "../actions";

export default function NewTemplatePage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-text mb-4">Neues Template</h1>
      <TemplateForm action={createTemplateAction} submitLabel="Template anlegen" />
    </div>
  );
}
