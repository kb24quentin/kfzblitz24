/**
 * /start?token=… — Shop-Hand-off-Landing-Page
 *
 * Ein externer Shop (z.B. das Shopware-Plugin `kb24-retoure`) hat dem
 * Kunden hierher einen kurzlebigen Prefill-Token gegeben. Wir zeigen
 * die mitgeschickten Daten read-only an, der Kunde bestätigt, und dann
 * leiten wir ihn in den normalen Customer-Flow weiter (mit der
 * Bestellnummer als Query-Param, damit er sie nicht erneut tippen
 * muss).
 *
 * Pragmatik-Entscheidung (Phase 9):
 * ────────────────────────────────
 * Die existierende Customer-Page (`(customer)/page.tsx`, 1000+ Zeilen
 * Client-Component mit eigenem State-Machine-Stepper) lässt sich nicht
 * sauber von außen mit Daten injizieren — sie startet mit einem leeren
 * Search-Field. Ein Refactor (State aus URL ableiten, Prefill als
 * Initial-State) wäre möglich, sprengt aber Phase 9. Daher der
 * minimale Pfad:
 *
 *   1. /start zeigt die Prefill-Daten read-only und einen Button.
 *   2. Beim Klick konsumieren wir den Token (consumedAt setzen) und
 *      leiten auf /?bestellnummer=… weiter.
 *   3. In einer Folge-PR liest die Customer-Page diesen Param aus und
 *      springt direkt in den Beleg-Detail-Step.
 *
 * Bis dahin spart der Hand-off-Flow dem Kunden zumindest die Anrede /
 * Anschrift / Item-Auswahl-Konfirmation — alles steht read-only vor
 * dem Klick. Wenn er weitergeht, tippt er die Bestellnummer noch
 * einmal NICHT, weil sie als Query-Param mitgegeben wird; ein leichter
 * Vorteil über den Status quo (manueller Aufruf von "/").
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PrefillPayload = {
  orderId?: string | null;
  bestellnummer: string;
  customer?: {
    anrede?: string;
    vorname?: string;
    name?: string;
    strasse?: string;
    plz?: string;
    ort?: string;
    email?: string;
    telefon?: string;
  } | null;
  items?: { artikelnummer?: string; menge?: number }[] | null;
  source?: string | null;
};

async function loadPrefill(token: string) {
  if (!token) return null;
  const row = await prisma.retourePrefill.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      bestellnummer: true,
      payloadJson: true,
      source: true,
      expiresAt: true,
      consumedAt: true,
    },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return { ...row, invalid: "expired" as const };
  if (row.consumedAt) return { ...row, invalid: "consumed" as const };
  let payload: PrefillPayload | null = null;
  try {
    payload = JSON.parse(row.payloadJson) as PrefillPayload;
  } catch {
    return { ...row, invalid: "corrupt" as const };
  }
  return { ...row, invalid: null as const, payload };
}

/**
 * Server-Action: markiert den Token als konsumiert und leitet auf den
 * Customer-Flow weiter. Wird vom Bestätigen-Button im Form-Submit
 * aufgerufen.
 */
async function consumeAndRedirect(formData: FormData): Promise<void> {
  "use server";
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/");

  // Race-safe via updateMany + Condition: nur konsumieren, wenn nicht
  // schon konsumiert/abgelaufen.
  const res = await prisma.retourePrefill.updateMany({
    where: {
      token,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });

  if (res.count === 0) {
    // Token wurde zwischen Load und Submit ungültig.
    redirect(`/start?token=${encodeURIComponent(token)}&error=invalid`);
  }

  const row = await prisma.retourePrefill.findUnique({
    where: { token },
    select: { bestellnummer: true },
  });
  const bn = row?.bestellnummer ?? "";
  redirect(`/?bestellnummer=${encodeURIComponent(bn)}`);
}

export default async function StartPage({
  searchParams,
}: {
  // Next 15: searchParams ist ein Promise.
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token = "", error } = await searchParams;
  const row = await loadPrefill(token);

  if (!row) {
    return <InvalidPage reason="not_found" />;
  }
  if (row.invalid) {
    return <InvalidPage reason={row.invalid} />;
  }

  const p = row.payload!;
  const c = p.customer ?? {};
  const items = p.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-primary">Retoure anmelden</h1>
        <p className="text-sm text-text-light mt-1">
          Deine Bestelldaten wurden vom Shop übergeben. Bitte prüfe sie und
          klicke unten auf <strong>Bestätigen und weiter</strong>, um die
          Retoure anzumelden.
        </p>
      </header>

      {error === "invalid" && (
        <div className="rounded border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          Der Link ist abgelaufen oder wurde bereits verwendet. Bitte starte
          den Vorgang im Shop erneut.
        </div>
      )}

      <section className="rounded border border-border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-2">
          Bestellung
        </h2>
        <p className="text-base">
          <span className="font-mono">{p.bestellnummer}</span>
        </p>
        {p.orderId && (
          <p className="text-xs text-text-light mt-1">
            Shop-Referenz: <span className="font-mono">{p.orderId}</span>
          </p>
        )}
      </section>

      {(c.anrede || c.vorname || c.name || c.strasse || c.plz || c.ort || c.email) && (
        <section className="rounded border border-border bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-2">
            Anschrift
          </h2>
          <p className="text-sm">
            {[c.anrede, c.vorname, c.name].filter(Boolean).join(" ")}
          </p>
          {c.strasse && <p className="text-sm">{c.strasse}</p>}
          {(c.plz || c.ort) && (
            <p className="text-sm">
              {[c.plz, c.ort].filter(Boolean).join(" ")}
            </p>
          )}
          {c.email && <p className="text-sm text-text-light mt-1">{c.email}</p>}
          {c.telefon && (
            <p className="text-sm text-text-light">Tel: {c.telefon}</p>
          )}
        </section>
      )}

      {items.length > 0 && (
        <section className="rounded border border-border bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-light mb-2">
            Vorgewählte Artikel
          </h2>
          <ul className="text-sm space-y-1">
            {items.map((it, i) => (
              <li key={i} className="flex justify-between">
                <span className="font-mono">{it.artikelnummer ?? "?"}</span>
                <span className="text-text-light">x {it.menge ?? 1}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-light mt-2">
            Die endgültige Auswahl triffst Du im nächsten Schritt — alle
            Positionen der Bestellung werden Dir dort angezeigt.
          </p>
        </section>
      )}

      <form action={consumeAndRedirect}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="bg-accent hover:bg-accent/90 text-white font-semibold rounded px-6 py-3 transition"
        >
          Bestätigen und weiter
        </button>
      </form>

      <p className="text-xs text-text-light">
        Der Link ist gültig bis {row.expiresAt.toLocaleString("de-DE")}.
      </p>
    </div>
  );
}

function InvalidPage({
  reason,
}: {
  reason: "not_found" | "expired" | "consumed" | "corrupt";
}) {
  const message =
    reason === "expired"
      ? "Dieser Link ist abgelaufen. Bitte starte die Retoure-Anmeldung im Shop erneut."
      : reason === "consumed"
        ? "Dieser Link wurde bereits verwendet. Bitte starte die Anmeldung im Shop erneut, falls Du noch keine Retoure abgeschlossen hast."
        : reason === "corrupt"
          ? "Der Link ist ungültig (Daten konnten nicht gelesen werden). Bitte starte erneut im Shop."
          : "Der Link ist ungültig. Bitte starte die Retoure-Anmeldung im Shop erneut.";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-primary">Link ungültig</h1>
      <div className="rounded border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
        {message}
      </div>
      <p>
        <Link href="/" className="text-accent underline">
          Zur Retoure-Startseite
        </Link>
      </p>
    </div>
  );
}
