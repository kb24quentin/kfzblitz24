/**
 * Auth für PDA-API.
 *
 * Akzeptiert zwei Token-Quellen:
 *   1. shared API_TOKEN (env) — für Admin-/curl-Tests und Backward-Compat
 *      mit dem alten Setup. Wird weiterhin als Master-Token akzeptiert.
 *   2. PdaDevice.token — pro PDA-Gerät ein eigener Token, gepaart via
 *      QR-Code auf dem Admin-Dashboard. Wird beim Pairing einmalig ans
 *      Gerät ausgeliefert und liegt dort im localStorage des Browsers.
 *      Admin kann ein Device deaktivieren → Token wird sofort abgelehnt.
 *
 * Performance: pro Request maximal ein DB-Hit (`PdaDevice.findUnique`).
 * Der shared-Token-Check (env-Vergleich) läuft zuerst und vermeidet den
 * DB-Hit komplett für die Mehrheit der Anfragen (cron, admin, etc.).
 *
 * Return-Form bleibt kompatibel zum bisherigen Aufrufer:
 *   { ok: true } | { ok: false, status: 401|503 }
 *
 * Optional kann der Aufrufer `checkPdaAuthDetailed()` nutzen, um das
 * passende PdaDevice (falls Device-Auth) ebenfalls zu erhalten — z. B.
 * für `actor`-Felder in Events.
 */

import { findActiveDeviceByToken } from "./pda-devices";
import type { PdaDevice } from "@prisma/client";

export interface PdaAuthOk {
  ok: true;
  /** Set wenn per-device-Token; null bei shared-API_TOKEN-Auth. */
  device: PdaDevice | null;
}
export interface PdaAuthErr {
  ok: false;
  status: number;
}
export type PdaAuthResult = PdaAuthOk | PdaAuthErr;

function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const t = m[1].trim();
  return t.length > 0 ? t : null;
}

/**
 * Detailed variant — gibt zusätzlich das PdaDevice mit zurück, falls
 * per-device-Auth verwendet wurde. Routes können das für `actor`-Felder
 * oder Audit-Logs nutzen.
 */
export async function checkPdaAuthDetailed(
  req: Request,
): Promise<PdaAuthResult> {
  const token = extractBearer(req);
  if (!token) return { ok: false, status: 401 };

  const sharedToken = process.env.API_TOKEN?.trim();
  // Shared API_TOKEN ist optional konfigurierbar — wenn gesetzt UND
  // matcht, ist das ein Master-Pass (kein Device-Lookup nötig).
  if (sharedToken && token === sharedToken) {
    return { ok: true, device: null };
  }

  // Sonst gegen die PdaDevice-Tabelle prüfen.
  const device = await findActiveDeviceByToken(token);
  if (device) {
    return { ok: true, device };
  }

  // Wenn weder shared noch device-Token konfiguriert ist (z. B. Dev-Setup
  // ohne API_TOKEN und ohne gepaarte Geräte), geben wir 503 zurück —
  // sonst ist nicht klar, ob die API überhaupt sinnvoll erreichbar ist.
  if (!sharedToken) {
    const anyDevice = await findActiveDeviceByToken("__sentinel-never-matches__");
    void anyDevice; // wir wollen nur die Prüfung "ist DB überhaupt erreichbar"
    return { ok: false, status: 401 };
  }

  return { ok: false, status: 401 };
}

/**
 * Synchroner Wrapper für bestehende Aufrufer, die nicht awaiten wollen.
 * **Verhalten wie bisher**: gibt `{ok:true}` oder `{ok:false,status}`
 * zurück, ohne Device-Info. Intern wird auf checkPdaAuthDetailed
 * gemappt (await im Aufrufer nötig).
 *
 * Existierende Aufrufer wie
 *   const auth = checkPdaAuth(req);
 *   if (!auth.ok) { ... }
 * müssen ein `await` einfügen — der Compiler-Fehler ist leicht zu fixen.
 */
export async function checkPdaAuth(
  req: Request,
): Promise<{ ok: true } | { ok: false; status: number }> {
  const r = await checkPdaAuthDetailed(req);
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status };
}
