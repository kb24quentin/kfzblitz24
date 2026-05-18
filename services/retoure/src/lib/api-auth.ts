/**
 * Bearer-Token-Auth für die Public REST-API (/api/retoure/*).
 *
 * Token kommt aus env API_TOKEN. Wenn nicht gesetzt, sind die Endpunkte
 * komplett gesperrt (sicher per default).
 */
export function checkBearer(req: Request): { ok: true } | { ok: false; status: number } {
  const required = process.env.API_TOKEN?.trim();
  if (!required) return { ok: false, status: 503 }; // not configured
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== required) return { ok: false, status: 401 };
  return { ok: true };
}
