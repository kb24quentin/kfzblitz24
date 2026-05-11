"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAssessment } from "@/lib/assess";

export async function runAssessmentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await runAssessment(id);
  revalidatePath(`/cases/${id}`);
  revalidatePath("/");
}

type Decision = "approved" | "rejected" | "more_docs_needed";

export async function decideCaseAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "") as Decision;
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const actor = String(formData.get("actor") ?? "").trim() || "admin";

  if (!id || !["approved", "rejected", "more_docs_needed"].includes(decision)) return;

  await prisma.b2BCase.update({
    where: { id },
    data: {
      status: decision,
      decision,
      decisionReason: reason,
      decidedBy: actor,
      decidedAt: new Date(),
    },
  });

  await prisma.b2BCaseEvent.create({
    data: {
      caseId: id,
      type: "decision",
      message: `Entscheidung: ${decision}${reason ? ` — ${reason}` : ""}`,
      actor,
    },
  });

  revalidatePath(`/cases/${id}`);
  revalidatePath("/");
}

export async function addNoteAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const actor = String(formData.get("actor") ?? "").trim() || "admin";
  if (!id || !note) return;
  await prisma.b2BCaseEvent.create({
    data: { caseId: id, type: "note", message: note, actor },
  });
  revalidatePath(`/cases/${id}`);
}
