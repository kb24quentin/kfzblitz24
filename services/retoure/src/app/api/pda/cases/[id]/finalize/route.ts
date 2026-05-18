/**
 * POST /api/pda/cases/:id/finalize
 *
 * Vom PDA aufgerufen, sobald alle (registered+extra, NICHT missing) Items
 * eines Cases ein verdict gesetzt haben. Tut zwei Dinge:
 *
 *   1. Triggert die Kunden-Mail (sendVerdictMail) — diese enthält je
 *      nach Verdict-Mix die Erstattungs-Info oder die Hinweise auf
 *      nicht zurücknehmbare Artikel.
 *   2. Setzt den Case-Status:
 *        all green       → "erstattet"
 *        any red         → "abgelehnt"
 *        sonst (mix)     → "pruefung"
 *
 * Idempotent: wenn der Case schon in einem dieser Zielzustände ist,
 * wird nichts mehr neu gemacht (außer ein erneuter Mail-Versuch, falls
 * der vorherige geskippt wurde — wir loggen das aber als Event und
 * blockieren nicht).
 *
 * Vorbedingung: mindestens ein nicht-missing Item, alle haben verdict.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkPdaAuth } from "@/lib/pda-auth";
import { transitionStatus, addEvent } from "@/lib/retoure-cases";
import { sendVerdictMail } from "@/lib/customer-mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status }
    );
  }
  const { id } = await params;

  const c = await prisma.retoureCase.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const relevant = c.items.filter((it) => it.status !== "missing");
  if (relevant.length === 0) {
    return NextResponse.json(
      { error: "Keine relevanten Items (alle missing?)" },
      { status: 409 }
    );
  }
  const missingVerdict = relevant.filter((it) => !it.verdict);
  if (missingVerdict.length > 0) {
    return NextResponse.json(
      {
        error: "Nicht alle Items haben verdict — finalize nicht möglich",
        pendingItems: missingVerdict.map((i) => i.id),
      },
      { status: 409 }
    );
  }

  const verdicts = relevant.map((it) => it.verdict!);
  const targetStatus = verdicts.every((v) => v === "green")
    ? "erstattet"
    : verdicts.some((v) => v === "red")
      ? "abgelehnt"
      : "pruefung";

  // Status setzen (no-op wenn schon dort)
  if (c.status !== targetStatus) {
    await transitionStatus(id, targetStatus, {
      actor: "pda",
      message: `Finalize: ${verdicts.length} items → ${targetStatus}`,
      meta: {
        green: verdicts.filter((v) => v === "green").length,
        yellow: verdicts.filter((v) => v === "yellow").length,
        red: verdicts.filter((v) => v === "red").length,
      },
    });
  }

  // Mail rauschicken
  const mail = await sendVerdictMail(id);
  if (!mail.ok) {
    await addEvent(
      id,
      "customer_mail_failed",
      `Verdict-Mail fehlgeschlagen: ${mail.error}`,
      { error: mail.error },
      "system"
    );
  } else if ("skipped" in mail && mail.skipped) {
    await addEvent(
      id,
      "customer_mail_skipped",
      `Verdict-Mail übersprungen: ${mail.reason}`,
      { reason: mail.reason },
      "system"
    );
  }

  return NextResponse.json({
    ok: true,
    caseStatus: targetStatus,
    verdicts: {
      green: verdicts.filter((v) => v === "green").length,
      yellow: verdicts.filter((v) => v === "yellow").length,
      red: verdicts.filter((v) => v === "red").length,
    },
    mail,
  });
}
