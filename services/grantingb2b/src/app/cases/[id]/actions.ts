"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { runAssessment } from "@/lib/assess";
import { saveUpload, UploadError } from "@/lib/upload";

const ALLOWED_DOC_KINDS = new Set([
  "gewerbeschein",
  "gewerbeschein_clearer",
  "ust_id_certificate",
  "handelsregister",
  "meisterbrief",
  "firmenbriefbogen",
  "personalausweis_inhaber",
  "address_proof",
  "bank_statement",
  "other",
]);

// Mapping: clearer-Variante befriedigt auch den Basis-Gewerbeschein-Need
const KIND_NORMALIZATIONS: Record<string, string> = {
  gewerbeschein_clearer: "gewerbeschein",
};

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

export type UploadDocState = { ok: boolean; message?: string };

/**
 * Nachgereichtes Dokument zu einem Case hochladen. Befriedigt die
 * entsprechende `requestedDocs`-Anforderung und triggert ein
 * Re-Assessment im Hintergrund.
 */
export async function uploadDocumentAction(
  _prev: UploadDocState,
  formData: FormData
): Promise<UploadDocState> {
  const id = String(formData.get("id") ?? "");
  const rawKind = String(formData.get("kind") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const actor = String(formData.get("actor") ?? "").trim() || "admin";
  const file = formData.get("file");

  if (!id) return { ok: false, message: "Case-ID fehlt." };
  if (!ALLOWED_DOC_KINDS.has(rawKind)) {
    return { ok: false, message: "Dokument-Typ ist ungültig." };
  }
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, message: "Bitte eine Datei auswählen." };
  }

  const kind = KIND_NORMALIZATIONS[rawKind] ?? rawKind;

  try {
    const stored = await saveUpload(file, id);
    await prisma.b2BCaseDocument.create({
      data: {
        caseId: id,
        kind,
        filename: stored.filename,
        path: stored.path,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        note,
        uploadedBy: actor,
      },
    });
    await prisma.b2BCaseEvent.create({
      data: {
        caseId: id,
        type: "document_uploaded",
        message: `${kind}: ${stored.filename}${note ? ` — ${note}` : ""}`,
        actor,
      },
    });
  } catch (e) {
    const msg = e instanceof UploadError ? e.message : `Upload-Fehler: ${String(e)}`;
    return { ok: false, message: msg };
  }

  // Re-Assessment im Hintergrund.
  await prisma.b2BCase.update({
    where: { id },
    data: { status: "assessing" },
  });
  after(async () => {
    try {
      await runAssessment(id);
    } catch (e) {
      await prisma.b2BCaseEvent.create({
        data: {
          caseId: id,
          type: "note",
          message: `Re-Assessment fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
          actor: "system",
        },
      });
    }
  });

  revalidatePath(`/cases/${id}`);
  return { ok: true, message: "Datei hochgeladen — Re-Prüfung läuft im Hintergrund." };
}

export async function deleteDocumentAction(formData: FormData) {
  const docId = String(formData.get("docId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  const actor = String(formData.get("actor") ?? "").trim() || "admin";
  if (!docId || !caseId) return;
  const doc = await prisma.b2BCaseDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.caseId !== caseId) return;
  await prisma.b2BCaseDocument.delete({ where: { id: docId } });
  await prisma.b2BCaseEvent.create({
    data: {
      caseId,
      type: "note",
      message: `Dokument entfernt: ${doc.kind} / ${doc.filename}`,
      actor,
    },
  });
  await prisma.b2BCase.update({ where: { id: caseId }, data: { status: "assessing" } });
  after(async () => {
    try {
      await runAssessment(caseId);
    } catch {
      /* silent */
    }
  });
  revalidatePath(`/cases/${caseId}`);
}
