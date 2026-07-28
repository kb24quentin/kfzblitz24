/**
 * 46Elks SMS-Provider. Config über env:
 *   SMS46ELKS_API_USERNAME  (API-Key = username)
 *   SMS46ELKS_API_PASSWORD  (API-Secret = password)
 *   SMS46ELKS_FROM          (absender-name, max 11 zeichen alphanumerisch, oder telefon-nr)
 *
 * Wenn nicht konfiguriert: sendSms wirft mit klarer message.
 * https://46elks.com/docs/send-sms
 */
export async function sendSms(to: string, message: string): Promise<{ id: string; cost: number }> {
  const username = process.env.SMS46ELKS_API_USERNAME?.trim();
  const password = process.env.SMS46ELKS_API_PASSWORD?.trim();
  const from = process.env.SMS46ELKS_FROM?.trim() || "WrkstattC";
  if (!username || !password) {
    throw new Error(
      "SMS-Versand nicht konfiguriert. Bitte SMS46ELKS_API_USERNAME + SMS46ELKS_API_PASSWORD in Umgebungsvariablen setzen."
    );
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const body = new URLSearchParams({
    from,
    to: normalizePhone(to),
    message,
  });

  const res = await fetch("https://api.46elks.com/a1/sms", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`46Elks HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  const j = (await res.json()) as { id: string; cost?: number };
  return { id: j.id, cost: j.cost ?? 0 };
}

/**
 * Normalisiert deutsche telefonnummer zu E.164 (+49xxxxxxxxxx).
 *   "0176 12345678" → "+4917612345678"
 *   "+491761234"    → "+491761234"
 */
function normalizePhone(s: string): string {
  const raw = s.replace(/[\s\/\-()]/g, "");
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return "+" + raw.slice(2);
  if (raw.startsWith("0")) return "+49" + raw.slice(1);
  return raw;
}
