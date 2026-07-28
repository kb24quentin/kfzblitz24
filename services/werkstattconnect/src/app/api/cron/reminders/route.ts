import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { customerDisplayName, vehicleDisplayName } from "@/lib/customer-name";

export const dynamic = "force-dynamic";

/**
 * Reminder-cron. Läuft täglich, findet pending-reminders wo
 * (dueDate - notifyDaysBefore) <= heute und sendet mail an kunde.
 *
 * Nur für Pro-Plan-workshops. Free-plan zeigt reminders nur in UI.
 * Auth: shared bearer via INTERNAL_API_TOKEN (analog anderer crons).
 */
export async function POST(req: Request) {
  const required = process.env.INTERNAL_API_TOKEN?.trim();
  if (!required) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (token !== required) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "resend not configured" }, { status: 503 });
  const resend = new Resend(key);
  const FROM_EMAIL = process.env.FROM_EMAIL || "service@kfzblitz24.de";
  const FROM_NAME = process.env.FROM_NAME || "WerkstattConnect";

  const now = new Date();
  const pendings = await prisma.reminder.findMany({
    where: {
      status: "pending",
      workshop: { active: true, plan: "pro" },
    },
    include: {
      workshop: { select: { name: true, contactEmail: true, contactPhone: true } },
      customer: true,
      vehicle: true,
    },
    take: 200,
  });

  const due = pendings.filter((r) => {
    const cutoff = new Date(r.dueDate.getTime() - r.notifyDaysBefore * 24 * 60 * 60 * 1000);
    return cutoff <= now;
  });

  const results: { id: string; ok: boolean; skipped?: string; error?: string }[] = [];

  for (const r of due) {
    if (!r.customer.email) {
      results.push({ id: r.id, ok: false, skipped: "kein email" });
      await prisma.reminder.update({
        where: { id: r.id },
        data: { status: "dismissed", sentAt: now },
      });
      continue;
    }
    const cName = customerDisplayName(r.customer);
    const salutation = r.customer.type === "b2b" ? `Sehr geehrte Damen und Herren` : `Guten Tag ${cName}`;
    const vehicleLine = r.vehicle ? `<br/><br/>Fahrzeug: <strong>${vehicleDisplayName(r.vehicle)}</strong>` : "";

    const html = `<!doctype html><html><body style="font-family:-apple-system,Arial,sans-serif;color:#0f172a;line-height:1.55;">
      <div style="max-width:560px;margin:24px auto;background:#fff;padding:28px;border-radius:12px;border:1px solid #e2e8f0;">
        <h2 style="margin:0 0 12px;color:#fe6503;">Erinnerung: ${escapeHtml(r.title)}</h2>
        <p>${salutation},</p>
        <p>wir möchten Sie daran erinnern, dass folgender Termin ansteht:</p>
        <p style="background:#fff7ed;padding:12px;border-radius:8px;border-left:4px solid #fe6503;">
          <strong>${escapeHtml(r.title)}</strong><br/>
          Fällig am: <strong>${r.dueDate.toLocaleDateString("de-DE")}</strong>
          ${vehicleLine}
        </p>
        ${r.note ? `<p>${escapeHtml(r.note)}</p>` : ""}
        <p>Vereinbaren Sie am besten zeitnah einen Termin${r.workshop.contactPhone ? ` unter <strong>${r.workshop.contactPhone}</strong>` : ""} oder antworten Sie einfach auf diese E-Mail.</p>
        <p>Mit freundlichen Grüßen,<br/><strong>${escapeHtml(r.workshop.name)}</strong></p>
      </div>
    </body></html>`;

    try {
      await resend.emails.send({
        from: `${r.workshop.name} <${FROM_EMAIL}>`,
        replyTo: r.workshop.contactEmail,
        to: [r.customer.email],
        subject: `Erinnerung: ${r.title}`,
        html,
      });
      await prisma.reminder.update({
        where: { id: r.id },
        data: { status: "sent", sentAt: now },
      });
      results.push({ id: r.id, ok: true });
    } catch (e) {
      results.push({ id: r.id, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
