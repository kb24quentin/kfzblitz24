"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nicht angemeldet");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User nicht gefunden");
  return user;
}

export async function addContactNoteAction(formData: FormData) {
  const user = await requireUser();
  const contactId = String(formData.get("contactId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!contactId || !body) return;

  await prisma.contactNote.create({
    data: { contactId, userId: user.id, body },
  });

  revalidatePath(`/contacts/${contactId}`);
}

export async function deleteContactNoteAction(formData: FormData) {
  const user = await requireUser();
  const noteId = String(formData.get("noteId") || "");
  if (!noteId) return;

  const note = await prisma.contactNote.findUnique({
    where: { id: noteId },
    select: { userId: true, contactId: true },
  });
  if (!note) return;
  // Nur eigene notes oder admin darf löschen
  if (note.userId !== user.id && user.role !== "admin") return;

  await prisma.contactNote.delete({ where: { id: noteId } });
  revalidatePath(`/contacts/${note.contactId}`);
}
