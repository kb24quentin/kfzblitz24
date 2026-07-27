/**
 * Shared-secret auth for cross-service calls (Intranet → CRM to
 * provision users). Same pattern as support-service.
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
