"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateReplyStatus(replyId: string, status: string) {
  await prisma.reply.update({
    where: { id: replyId },
    data: { status },
  });
  revalidatePath("/inbox");
}

export async function sendReply(replyId: string, responseText: string) {
  const reply = await prisma.reply.findUnique({
    where: { id: replyId },
    include: { contact: true },
  });

  if (!reply) throw new Error("Reply not found");

  // TODO: Send actual email via Resend
  // For now, just save the response
  await prisma.reply.update({
    where: { id: replyId },
    data: {
      ourResponse: responseText,
      respondedAt: new Date(),
      status: "resolved",
    },
  });

  revalidatePath("/inbox");
}
