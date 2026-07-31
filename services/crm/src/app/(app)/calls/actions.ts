"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Nach wie vielen "nicht erreicht"-Versuchen geben wir auf.
export const MAX_CALL_RETRIES = 5;

// Wie viele Tage später soll der nächste Versuch stattfinden.
const RETRY_DELAY_DAYS = 1;

export type CallOutcome =
  | "reached"          // erfolgreich gesprochen — done
  | "voicemail"        // Mailbox erreicht — retry
  | "wrong_number"     // falsche Nummer — retry, aber User sollte Nummer korrigieren
  | "not_reached"      // niemand dran, kein AB — retry
  | "not_interested"   // gesprochen aber Absage — done
  | "appointment";     // Termin vereinbart — done

const OUTCOMES_THAT_RETRY: CallOutcome[] = ["voicemail", "wrong_number", "not_reached"];
const OUTCOMES_THAT_FINISH: CallOutcome[] = ["reached", "not_interested", "appointment"];

export type LogCallInput = {
  reminderId: string;
  outcome: CallOutcome;
  notes: string;
  newContactStatus?: string | null;
};

export type LogCallResult = {
  ok: boolean;
  message: string;
  // Wenn wir retried haben: neue dueDate für UI-Feedback
  retryScheduledFor?: Date;
};

export async function logCall(input: LogCallInput): Promise<LogCallResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, message: "Nicht eingeloggt." };
  const me = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!me) return { ok: false, message: "User nicht gefunden." };

  const reminder = await prisma.reminder.findUnique({
    where: { id: input.reminderId },
    include: { contact: true, step: { include: { campaign: true } } },
  });
  if (!reminder) return { ok: false, message: "Reminder nicht gefunden." };
  if (reminder.status !== "pending") {
    return { ok: false, message: "Dieser Anruf wurde schon abgeschlossen." };
  }

  const now = new Date();
  const isRetryable = OUTCOMES_THAT_RETRY.includes(input.outcome);
  const isFinal = OUTCOMES_THAT_FINISH.includes(input.outcome);
  const willBeMaxedOut = reminder.retryCount + 1 >= MAX_CALL_RETRIES;

  // Kombiniertes Activity-Log — was hat der User gemacht.
  const activityContent = buildActivityContent(input, reminder.retryCount);
  const campaignHint = reminder.step?.campaign?.name
    ? ` (Kampagne: ${reminder.step.campaign.name})`
    : "";

  await prisma.activity.create({
    data: {
      contactId: reminder.contactId,
      userId: me.id,
      type: "call",
      content: activityContent + campaignHint,
    },
  });

  await prisma.contact.update({
    where: { id: reminder.contactId },
    data: {
      lastContactedAt: now,
      ...(input.newContactStatus ? { status: input.newContactStatus } : {}),
    },
  });

  if (isFinal || (isRetryable && willBeMaxedOut)) {
    // Endgültig — Reminder auf done, resolution setzen.
    const finalResolution: string = isFinal
      ? input.outcome
      : "gave_up";
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: "done",
        resolution: finalResolution,
        retryCount: isRetryable ? reminder.retryCount + 1 : reminder.retryCount,
      },
    });
    if (finalResolution === "gave_up") {
      await prisma.activity.create({
        data: {
          contactId: reminder.contactId,
          userId: me.id,
          type: "note",
          content: `${MAX_CALL_RETRIES}× vergeblich versucht — Anruf-Reminder aufgegeben${campaignHint}`,
        },
      });
    }
    revalidatePath("/calls");
    revalidatePath(`/contacts/${reminder.contactId}`);
    return { ok: true, message: buildOkMessage(input.outcome, isFinal, willBeMaxedOut) };
  }

  // Retry — Reminder-dueDate schieben und retryCount+1.
  const nextDue = new Date(now);
  nextDue.setDate(nextDue.getDate() + RETRY_DELAY_DAYS);
  await prisma.reminder.update({
    where: { id: reminder.id },
    data: {
      dueDate: nextDue,
      retryCount: reminder.retryCount + 1,
      resolution: input.outcome,
    },
  });
  revalidatePath("/calls");
  revalidatePath(`/contacts/${reminder.contactId}`);
  return {
    ok: true,
    message: `Nächster Versuch geplant für ${nextDue.toLocaleDateString("de-DE")} (Versuch ${reminder.retryCount + 2}/${MAX_CALL_RETRIES}).`,
    retryScheduledFor: nextDue,
  };
}

function buildActivityContent(input: LogCallInput, prevRetries: number): string {
  const attempt = prevRetries + 1;
  const label = outcomeLabel(input.outcome);
  const base = `Anruf-Versuch ${attempt}: ${label}`;
  return input.notes.trim() ? `${base} — ${input.notes.trim()}` : base;
}

function outcomeLabel(o: CallOutcome): string {
  switch (o) {
    case "reached": return "Erreicht";
    case "voicemail": return "Mailbox";
    case "wrong_number": return "Falsche Nummer";
    case "not_reached": return "Niemand am Apparat";
    case "not_interested": return "Kein Interesse";
    case "appointment": return "Termin vereinbart";
  }
}

function buildOkMessage(outcome: CallOutcome, isFinal: boolean, gaveUp: boolean): string {
  if (isFinal) {
    if (outcome === "appointment") return "Termin vereinbart — Reminder erledigt.";
    if (outcome === "reached") return "Erfolgreich gesprochen — Reminder erledigt.";
    return "Reminder erledigt.";
  }
  if (gaveUp) return `Maximale Anrufversuche (${MAX_CALL_RETRIES}) erreicht — Reminder aufgegeben.`;
  return "Reminder aktualisiert.";
}

// Manueller Snooze (User will's später erneut versuchen, ohne Ergebnis zu loggen).
export async function snoozeCall(reminderId: string, byDays: number = 1): Promise<{ ok: boolean; newDue?: Date }> {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder) return { ok: false };
  const newDue = new Date();
  newDue.setDate(newDue.getDate() + byDays);
  await prisma.reminder.update({
    where: { id: reminderId },
    data: { dueDate: newDue },
  });
  revalidatePath("/calls");
  return { ok: true, newDue };
}
