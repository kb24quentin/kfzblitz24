/**
 * Fixed brand signature template — everyone gets this layout, only 3 fields
 * (Name, Position, Email) are user-editable. Inline styles + table layout
 * so it survives Gmail/Outlook.
 */

import { prisma } from "@/lib/db";

export type SignatureFields = {
  displayName: string;
  position: string;
  email: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderSignatureHtml(f: SignatureFields): string {
  const name = escapeHtml(f.displayName);
  const position = escapeHtml(f.position);
  const email = escapeHtml(f.email);
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

/**
 * Returns the fields to prefill the signature editor with — either the user's
 * saved override, or defaults derived from their User row.
 */
export function fieldsForUser(user: {
  name: string;
  email: string;
  role: string;
}, override?: { displayName: string; position: string; email: string } | null): SignatureFields {
  if (override) return override;
  return {
    displayName: user.name,
    position: user.role === "admin" ? "Administrator" : "Kundenservice",
    email: user.email,
  };
}

/**
 * Loads the rendered signature HTML for a user. Returns null if userId not
 * provided (e.g. system-sent auto-ack). Auto-creates a Signature row on
 * first use so the user has something to edit later.
 */
export async function loadSignatureHtmlForUser(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { signature: true },
  });
  if (!user) return null;
  const fields = fieldsForUser(
    { name: user.name, email: user.email, role: user.role },
    user.signature
      ? {
          displayName: user.signature.displayName,
          position: user.signature.position,
          email: user.signature.email,
        }
      : null,
  );
  return renderSignatureHtml(fields);
}
