import { Resend } from "resend";
import { prisma } from "./db";

let _resend: Resend | null = null;
function client(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

function fromAddress(): string {
  const name = process.env.FROM_NAME?.trim() || "kfzBlitz24 Intranet";
  const email = process.env.FROM_EMAIL?.trim() || "service@kfzblitz24.de";
  return `"${name.replace(/"/g, "")}" <${email}>`;
}

function wrap(html: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a202c;font-size:14px;line-height:1.6;">
<div style="background:#0b3756;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;font-weight:600;font-size:16px;">
  kfzBlitz24 Intranet
</div>
<div style="background:#fff;border:1px solid #e6e8eb;border-top:0;padding:24px;border-radius:0 0 8px 8px;">
  ${html}
</div>
<div style="text-align:center;font-size:11px;color:#8a93a0;margin-top:16px;">
  Automatische Benachrichtigung aus dem kfzBlitz24 Intranet
</div>
</div>`;
}

async function sendTo(to: string[], subject: string, innerHtml: string) {
  const c = client();
  if (!c || to.length === 0) return;
  try {
    await c.emails.send({
      from: fromAddress(),
      to,
      subject,
      html: wrap(innerHtml),
    });
  } catch (err) {
    console.warn("[notify] send failed:", err instanceof Error ? err.message : err);
  }
}

/** Notify all active admins. */
export async function notifyAdmins(subject: string, innerHtml: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "admin", active: true },
    select: { email: true },
  });
  await sendTo(admins.map((a) => a.email), subject, innerHtml);
}

/** Notify one specific user. */
export async function notifyUser(email: string, subject: string, innerHtml: string): Promise<void> {
  await sendTo([email], subject, innerHtml);
}
