export const dynamic = "force-dynamic";
import { createContact } from "../actions";
import { ContactForm } from "@/components/contact-form";

export default function NewContactPage() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-text mb-6">Neuen Kontakt anlegen</h2>
      <ContactForm action={createContact} />
    </div>
  );
}
