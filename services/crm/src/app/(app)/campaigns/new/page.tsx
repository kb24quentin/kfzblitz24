export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { CampaignForm } from "@/components/campaign-form";
import { createCampaign } from "../actions";

export default async function NewCampaignPage() {
  const [templates, contacts] = await Promise.all([
    prisma.template.findMany({ orderBy: { name: "asc" } }),
    prisma.contact.findMany({
      where: { status: { in: ["new", "contacted"] } },
      orderBy: { lastName: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-bold text-text mb-6">Neue Kampagne erstellen</h2>
      <CampaignForm action={createCampaign} templates={templates} contacts={contacts} />
    </div>
  );
}
