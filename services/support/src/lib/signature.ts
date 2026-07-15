/**
 * Fixed brand signature template. Everyone gets the same layout + the same
 * outgoing email (from FROM_EMAIL env — the shared service@ mailbox).
 * Only Name and Position are user-editable.
 */

import { prisma } from "@/lib/db";

export type SignatureFields = {
  displayName: string;
  position: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function signatureEmail(): string {
  return process.env.FROM_EMAIL?.trim() || "service@kfzblitz24.de";
}

export function renderSignatureHtml(f: SignatureFields): string {
  const name = escapeHtml(f.displayName);
  const position = escapeHtml(f.position);
  const email = escapeHtml(signatureEmail());
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a202c;">
  <tr>
    <td style="padding:0;">
      <div style="font-size:15px;font-weight:700;color:#0b3756;line-height:1.3;letter-spacing:-0.2px;">${name}</div>
      <div style="font-size:13px;color:#4a5568;line-height:1.5;margin-top:2px;">${position} &middot; kfzBlitz24 GmbH</div>
    </td>
  </tr>
  <tr>
    <td style="padding:12px 0 12px 0;">
      <img src="https://support.kfzblitz24-group.com/sig-logo.png" width="200" height="auto" alt="kfzBlitz24" style="display:block;border:0;outline:none;text-decoration:none;">
    </td>
  </tr>
  <tr>
    <td style="padding:0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:1px 12px 1px 0;font-size:12px;color:#718096;font-weight:600;">E-Mail</td>
          <td style="padding:1px 0;font-size:12px;"><a href="mailto:${email}" style="color:#ff6600;text-decoration:none;font-weight:600;">${email}</a></td>
        </tr>
        <tr>
          <td style="padding:1px 12px 1px 0;font-size:12px;color:#718096;font-weight:600;">Web</td>
          <td style="padding:1px 0;font-size:12px;"><a href="https://www.kfzblitz24.de" style="color:#ff6600;text-decoration:none;font-weight:600;">www.kfzblitz24.de</a></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="border-top:3px solid #ff6600;padding:8px 0 0 0;font-size:11px;line-height:1.5;color:#718096;">
      kfzBlitz24 GmbH &middot; Bomhardstra&szlig;e 7 &middot; 82031 Gr&uuml;nwald bei M&uuml;nchen<br>
      Gesch&auml;ftsf&uuml;hrer: Christian Engert &middot; HRB 291765, Amtsgericht M&uuml;nchen &middot; USt-ID: DE367617344
    </td>
  </tr>
</table>`;
}

export function fieldsForUser(
  user: { name: string; role: string },
  override?: { displayName: string; position: string } | null,
): SignatureFields {
  if (override) return override;
  return {
    displayName: user.name,
    position: user.role === "admin" ? "Administrator" : "Kundenservice",
  };
}

export async function loadSignatureHtmlForUser(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { signature: true },
  });
  if (!user) return null;
  const fields = fieldsForUser(
    { name: user.name, role: user.role },
    user.signature
      ? { displayName: user.signature.displayName, position: user.signature.position }
      : null,
  );
  return renderSignatureHtml(fields);
}
