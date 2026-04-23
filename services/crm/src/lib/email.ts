/**
 * Builds an RFC-5322 sender address from FROM_NAME + FROM_EMAIL.
 * Quotes the name so display strings containing -, , or other tokens are safe.
 *
 *   FROM_NAME="Corinna Wagner - kfzBlitz24"
 *   FROM_EMAIL=corinna.wagner@kfzblitz24-group.com
 *   → '"Corinna Wagner - kfzBlitz24" <corinna.wagner@kfzblitz24-group.com>'
 */
export function getFromAddress(): string {
  const name = process.env.FROM_NAME?.trim();
  const email = process.env.FROM_EMAIL?.trim() || "noreply@kfzblitz24-group.com";
  if (!name) return email;
  // Strip stray quotes from the env value, then re-quote
  const safeName = name.replace(/"/g, "");
  return `"${safeName}" <${email}>`;
}
