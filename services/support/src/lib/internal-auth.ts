/**
 * Shared-secret auth for cross-service calls (e.g. intranet → support to
 * provision users). Kept separate from api-auth.ts (cron bearer) so we can
 * rotate the two secrets independently.
 */
export function checkInternalBearer(req: Request):
  | { ok: true }
  | { ok: false; status: 401 | 503 } {
  const required = process.env.INTERNAL_API_TOKEN?.trim();
  if (!required) return { ok: false, status: 503 };
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== required) return { ok: false, status: 401 };
  return { ok: true };
}
