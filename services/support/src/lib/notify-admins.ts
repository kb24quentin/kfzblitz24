import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { getFromAddress } from "@/lib/email";
import { wrapEmailHtml } from "@/lib/email";

let _resend: Resend | null = null;
function client(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

/** Fire-and-forget: mail all active admins with a subject + inner-html body. */
export async function notifyAdmins(subject: string, innerHtml: string): Promise<void> {
  const c = client();
  if (!c) return;
  const admins = await prisma.user.findMany({
    where: { role: "admin", active: true },
    select: { email: true },
  });
  if (admins.length === 0) return;
  try {
    await c.emails.send({
      from: getFromAddress(),
      to: admins.map((a) => a.email),
      subject,
      html: wrapEmailHtml(innerHtml),
    });
  } catch (err) {
    console.warn("[notify-admins] send failed:", err instanceof Error ? err.message : err);
  }
}
