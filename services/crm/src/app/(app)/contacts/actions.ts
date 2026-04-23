"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getCurrentUserId() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  return user?.id || null;
}

export async function createContact(formData: FormData) {
  const userId = await getCurrentUserId();
  const contact = await prisma.contact.create({
    data: {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      company: (formData.get("company") as string) || null,
      position: (formData.get("position") as string) || null,
      phone: (formData.get("phone") as string) || null,
      city: (formData.get("city") as string) || null,
      notes: (formData.get("notes") as string) || null,
      outreach: (formData.get("outreach") as string) || "remote",
      tags: formData.get("tags") ? JSON.stringify((formData.get("tags") as string).split(",").map(t => t.trim()).filter(Boolean)) : "[]",
      assignedToId: (formData.get("assignedToId") as string) || null,
    },
  });

  await prisma.activity.create({
    data: { contactId: contact.id, userId, type: "note", content: "Kontakt erstellt" },
  });

  revalidatePath("/contacts");
  redirect("/contacts");
}

export async function updateContact(formData: FormData) {
  const id = formData.get("id") as string;
  const userId = await getCurrentUserId();
  const old = await prisma.contact.findUnique({ where: { id } });

  await prisma.contact.update({
    where: { id },
    data: {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      company: (formData.get("company") as string) || null,
      position: (formData.get("position") as string) || null,
      phone: (formData.get("phone") as string) || null,
      city: (formData.get("city") as string) || null,
      notes: (formData.get("notes") as string) || null,
      status: (formData.get("status") as string) || old?.status || "new",
      priority: (formData.get("priority") as string) || old?.priority || "medium",
      source: (formData.get("source") as string) || old?.source || "manual",
      outreach: (formData.get("outreach") as string) || old?.outreach || "remote",
      assignedToId: (formData.get("assignedToId") as string) || null,
      tags: formData.get("tags") ? JSON.stringify((formData.get("tags") as string).split(",").map(t => t.trim()).filter(Boolean)) : "[]",
    },
  });

  // Log status change
  if (old && formData.get("status") && old.status !== formData.get("status")) {
    await prisma.activity.create({
      data: {
        contactId: id, userId, type: "status_change",
        oldValue: old.status, newValue: formData.get("status") as string,
      },
    });
  }

  await prisma.activity.create({
    data: { contactId: id, userId, type: "contact_edited", content: "Kontakt bearbeitet" },
  });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function deleteContact(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contacts");
}

export async function importContacts(contacts: Array<{
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  position?: string;
  phone?: string;
  city?: string;
}>) {
  let imported = 0;
  let skipped = 0;

  for (const contact of contacts) {
    try {
      await prisma.contact.create({
        data: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          company: contact.company || null,
          position: contact.position || null,
          phone: contact.phone || null,
          city: contact.city || null,
          source: "import",
        },
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/contacts");
  return { imported, skipped };
}
