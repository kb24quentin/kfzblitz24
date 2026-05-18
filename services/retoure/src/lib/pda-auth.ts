/**
 * Auth für PDA-API.
 *
 * Phase 1 (jetzt): einfacher shared Bearer-Token (API_TOKEN) wie bei /api/retoure.
 *   Reicht zum Start: Android-Dev kann sofort entwickeln.
 *
 * Phase 2 (später, vor Live-Rollout): Device-Token-Flow.
 *   - Admin generiert im Dashboard einen Pairing-Code für ein neues PDA
 *   - PDA-App gibt Pairing-Code ein → bekommt eigenen Bearer-Token
 *   - jedes Device-Token ist eindeutig → Audit pro PDA möglich
 *   - Admin kann ein PDA-Device deaktivieren (z.B. bei Verlust)
 */

import { checkBearer } from "./api-auth";

export function checkPdaAuth(req: Request) {
  // Aktuell identisch mit der globalen API-Auth.
  // Wird später durch Device-Token-Validierung ersetzt.
  return checkBearer(req);
}
