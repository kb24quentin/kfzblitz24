/**
 * POST /api/pda/pair
 *
 * Tauscht einen Pairing-Code gegen das eigentliche Device-Token-Setup.
 * **Bewusst keine Bearer-Auth** — der Code IST der Geheim-Träger. Wer
 * den Code hat, darf einmalig pairen. One-shot: nach erfolgreichem
 * Tausch wird der Code in der DB gelöscht.
 *
 * Body: `{ code: string }`
 * Response 200: `{ token, pdaId }`
 * Response 400: `{ error }` — Code fehlt oder ist invalid/expired/consumed
 *
 * Rate-Limit: bewusst nicht hier — der Code-Raum (>10^11 mit unserem
 * Alphabet auf 8 Zeichen) ist groß genug, und TTL ist 10 Min. Wenn das
 * mal zum Problem wird, an Traefik-Middleware delegieren.
 */
import { NextResponse } from "next/server";
import { consumePairing } from "@/lib/pda-devices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { code?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body ist kein JSON" }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "code fehlt" }, { status: 400 });
  }

  // Aus URL-Strings den ?code=… extrahieren, falls der Mitarbeiter
  // versehentlich die ganze QR-URL ins Feld gepastet hat.
  let normalized = code;
  if (/^https?:\/\//i.test(code)) {
    try {
      const parsed = new URL(code);
      const cParam = parsed.searchParams.get("code");
      if (cParam) normalized = cParam;
    } catch {
      // ignore — geht weiter mit dem original-String
    }
  }

  const result = await consumePairing(normalized);
  if (!result) {
    return NextResponse.json(
      {
        error:
          "Pairing-Code ungültig, abgelaufen oder bereits benutzt. " +
          "Bitte im Admin-Dashboard einen neuen Code generieren.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    token: result.token,
    pdaId: result.pdaId,
  });
}
