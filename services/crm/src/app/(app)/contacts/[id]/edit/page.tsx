export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { updateContact } from "../../actions";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [contact, users] = await Promise.all([
    prisma.contact.findUnique({ where: { id } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!contact) notFound();

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-text mb-6">Kontakt bearbeiten</h2>
      <ContactForm action={updateContact} contact={contact} users={users} />
    </div>
  );
}
