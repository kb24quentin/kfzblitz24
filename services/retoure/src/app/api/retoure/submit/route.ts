/**
 * POST /api/retoure/submit
 *
 * Native-in-Shop-Submit-Endpoint. Customer hat im Shop eine Retoure
 * angemeldet, Plugin schickt fertige Form-Daten an uns.
 *
 * Auth: Bearer (API_TOKEN).
 *
 * Workflow:
 *   1. Validation (bestellnummer, items, grund_codes, photo-required-Logik)
 *   2. Eligibility-Check (Frist + offene Cases)
 *   3. RetoureCase + RetoureItem-Rows anlegen
 *   4. Pending-Photos den Items zuordnen + zu RetoureItemPhoto promovieren
 *   5. Status-Event "status_changed" (null → angemeldet) feuern
 *   6. Response mit caseId + eligibleUntil + Item-IDs zurückgeben
 *
 * DHL-Label-Generation passiert NICHT inline — der Shop kann sie via
 * GET /cases/{id}/shipping-label-pdf abholen sobald sie da ist.
 *
 * Siehe `docs/03-integration-guide.md` für Plugin-Side-Implementierung.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkBearer } from "@/lib/api-auth";
import { isValidReasonCode, RETURN_REASONS } from "@/lib/return-reasons";
import { checkEligibility, computeEligibleUntil } from "@/lib/eligibility";
import { enqueueWebhook } from "@/lib/webhook-dispatcher";
import { addEvent } from "@/lib/retoure-cases";
import { promoteToItemPhoto } from "@/lib/pending-photos";
import { createRetoureLabel } from "@/lib/dodajpaczke";
import { fetchBelegByNumber, getWebiscoConfig } from "@/lib/webisco";
import { parseArtikelnummer } from "@/lib/artikelnummer-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SubmitBody {
  bestellnummer?: string;
  orderId?: string;
  source?: "shopware" | "amazon" | "ebay" | "direct";
  kategorie?: "widerruf" | "gewaehrleistung";
  kundenstatus?: "privat" | "gewerbe_vorsteuer";
  customer?: {
    anrede?: string;
    vorname?: string;
    name?: string;
    strasse?: string;
    plz?: string;
    ort?: string;
    land?: string;
    email?: string;
    telefon?: string;
  };
  items?: Array<{
    artikelnummer?: string;
    menge?: number;
    grund_code?: string;
    grund_freitext?: string;
    photo_ids?: string[];
  }>;
  /**
   * Hat der Customer im Shop-Form „DHL-Label über uns" gewählt?
   * - Wenn premium_return.free_label=true → Label kostenfrei (labelFee=0)
   * - Sonst → Label kostet 5,50 € (wird vom Refund abgezogen)
   * - false → Customer versendet selbst, kein Label generiert
   */
  label_requested?: boolean;
  /**
   * Rückgabe+ Premium-Service. Wird vom Shop ermittelt anhand der
   * Original-Order (Line-Item mit productNumber=RUECKGABE-PLUS).
   * Beeinflusst Frist (30 Tage statt 14) und Label-Kosten (gratis).
   */
  premium_return?: {
    active?: boolean;
    frist_tage?: 14 | 30;
    free_label?: boolean;
    purchased_price_eur?: number;
  };
  /**
   * Frist bis Customer das Paket abschicken muss. KOMMT VOM SHOP als
   * Source-of-Truth — wir kennen das Rückgabe+-Konzept nicht und
   * können nicht autonom rechnen ob 14 oder 30 Tage.
   *
   * Wenn nicht gesetzt → Backend-Fallback auf 14 Tage ab createdAt
   * (defensive, weil Standard-Frist).
   */
  eligibleUntil?: string;
  abholung_gewuenscht?: boolean;
}

const LABEL_FEE_STANDARD_EUR = 5.5;

interface ValidationErrors {
  [field: string]: string;
}

export async function POST(req: Request) {
  const auth = checkBearer(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status },
    );
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Validation ───────────────────────────────────────────────────
  const errors: ValidationErrors = {};
  const bestellnummer = (body.bestellnummer ?? "").trim();
  if (!bestellnummer) errors["bestellnummer"] = "required";

  const source = body.source ?? "direct";
  const kategorie = body.kategorie ?? "widerruf";
  const kundenstatus = body.kundenstatus ?? "privat";

  // Rückgabe+ Premium-Service-Detection
  const premiumReturn = body.premium_return ?? null;
  const isPremium = premiumReturn?.active === true;
  const freeLabel = isPremium && premiumReturn?.free_label !== false;

  const labelRequested = body.label_requested ?? false;
  // Premium → Label gratis. Standard + label_requested → 5,50 €. Sonst kein Label.
  const labelFeeBrutto =
    labelRequested && !freeLabel ? LABEL_FEE_STANDARD_EUR : 0;
  const labelPaid = labelRequested && !freeLabel;
  // shippingMode persistieren als Audit/Display: "sicher" bei Premium, sonst "standard"
  const shippingMode = isPremium ? "sicher" : "standard";

  if (!body.customer?.email) {
    errors["customer.email"] = "required";
  }
  if (!body.customer?.name) {
    errors["customer.name"] = "required";
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors["items"] = "min_one_item";
  } else {
    body.items.forEach((it, idx) => {
      if (!it.artikelnummer) errors[`items[${idx}].artikelnummer`] = "required";
      if (!it.menge || it.menge < 1) errors[`items[${idx}].menge`] = "min_one";
      if (!it.grund_code) {
        errors[`items[${idx}].grund_code`] = "required";
      } else if (!isValidReasonCode(it.grund_code)) {
        errors[`items[${idx}].grund_code`] = "invalid_code";
      } else {
        const spec = RETURN_REASONS[it.grund_code];
        if (spec.photoRequired && (!it.photo_ids || it.photo_ids.length === 0)) {
          errors[`items[${idx}].photo_ids`] = "photo_required_for_reason";
        }
        if (it.grund_code === "anderes" && !it.grund_freitext?.trim()) {
          errors[`items[${idx}].grund_freitext`] = "required_for_anderes";
        }
      }
    });
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "validation_failed", fields: errors },
      { status: 422 },
    );
  }

  // ── Eligibility-Check ─────────────────────────────────────────────
  // Hier (im Submit) ist es ein Hard-Gate, im UI ist es nur ein Hinweis.
  const elig = await checkEligibility(bestellnummer, { kundenstatus });
  if (!elig.eligible) {
    return NextResponse.json(
      {
        error: "not_eligible",
        reason: elig.reason,
        existingCases: elig.existingCases.map((c) => ({
          id: c.id,
          bestellnummer: c.bestellnummer,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
        })),
      },
      { status: 409 },
    );
  }

  // ── Webisco-Enrichment ────────────────────────────────────────────
  // Shop schickt nur artikelnummer + menge. Wir holen die Order aus
  // Webisco und matchen Items → bekommen Preise, Gewicht, Hersteller,
  // Beschreibung, EK-Preis. Plus: belegId/belegnummer/belegdatum am Case
  // + Order-Snapshot in orderPositionsJson (für PDA extra/unknown-Logik).
  //
  // Wenn Webisco nicht erreichbar oder Order nicht gefunden: Submit läuft
  // trotzdem durch mit den Shop-Daten als Fallback. Event mit warning
  // dokumentiert den Skip.
  type WebiscoPosition = {
    artikelnummer?: string;
    hersteller?: string;
    beschreibung?: string;
    einzelpreis_brutto?: number | null;
    gesamtpreis_brutto?: number | null;
    einkaufspreis_brutto?: number | null;
    einzelgewicht_g?: number | null;
    einspeiserid?: number | null;
    positionId?: string | number;
  };
  let webiscoBelegId: string | null = null;
  let webiscoBelegnummer: string | null = null;
  let webiscoBelegdatum: string | null = null;
  let webiscoPositions: WebiscoPosition[] = [];
  let webiscoSkipReason: string | null = null;

  const webiscoConfig = getWebiscoConfig();
  if (!webiscoConfig) {
    webiscoSkipReason = "webisco_not_configured";
  } else {
    try {
      const wbRes = await fetchBelegByNumber(webiscoConfig, {
        typ: "auftrag", // Bestellnummer-Suche braucht typ=auftrag (lessons learned)
        id: bestellnummer,
      });
      if (wbRes.ok && wbRes.data.length > 0) {
        const beleg = wbRes.data[0];
        webiscoBelegId = beleg.id != null ? String(beleg.id) : null;
        webiscoBelegnummer = beleg.belegnummer ?? null;
        webiscoBelegdatum = beleg.belegdatum ?? null;
        webiscoPositions = (beleg.positionen ?? []) as WebiscoPosition[];
      } else {
        webiscoSkipReason = wbRes.ok ? "order_not_found_in_webisco" : `webisco_error:${wbRes.error ?? "unknown"}`;
      }
    } catch (err) {
      webiscoSkipReason = `webisco_exception:${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Helper: matche eine Submit-Item-Artikelnummer gegen Webisco-Positionen.
  // Bei Multi-Same-Item-Cases (Customer hat 2× gleichen Artikel im Cart)
  // hilft die positionId aus dem #-Suffix zur Disambiguierung.
  function findWebiscoMatch(
    parsedArtNr: string,
    parsedPosId: string | null,
  ): WebiscoPosition | null {
    if (!parsedArtNr) return null;
    const normalize = (s: string | undefined) =>
      (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const target = normalize(parsedArtNr);

    // 1) Wenn positionId angegeben: exaktes Match anstreben
    if (parsedPosId) {
      const hit = webiscoPositions.find(
        (p) =>
          String(p.positionId ?? "") === parsedPosId &&
          normalize(p.artikelnummer) === target,
      );
      if (hit) return hit;
    }
    // 2) Sonst: erstes Artikelnummer-Match
    return (
      webiscoPositions.find((p) => normalize(p.artikelnummer) === target) ??
      null
    );
  }

  // ── Case + Items anlegen ──────────────────────────────────────────
  const customer = body.customer ?? {};

  // eligibleUntil-Priorität:
  //   1. Body-Wert vom Shop (kennt Premium-Return, AGB-Sonderfälle etc.)
  //   2. Eligibility-Check-Wert (berechnet aus deliveredAt-Hint)
  //   3. computeEligibleUntil-Fallback (14 Tage ab jetzt)
  let eligibleUntil: Date;
  if (body.eligibleUntil) {
    const parsed = new Date(body.eligibleUntil);
    if (!isNaN(parsed.getTime())) {
      eligibleUntil = parsed;
    } else {
      eligibleUntil = elig.eligibleUntil ?? computeEligibleUntil(new Date(), kategorie);
    }
  } else {
    eligibleUntil = elig.eligibleUntil ?? computeEligibleUntil(new Date(), kategorie);
  }

  // Voraussichtliche Erstattung serverseitig aus Webisco-Preisen berechnen
  let warenwertBrutto = 0;
  for (const it of body.items ?? []) {
    const parsed = parseArtikelnummer(it.artikelnummer ?? "");
    const match = findWebiscoMatch(parsed.artikelnummer, parsed.positionId);
    if (match?.einzelpreis_brutto != null) {
      warenwertBrutto += match.einzelpreis_brutto * (it.menge ?? 1);
    }
  }
  const voraussichtlicheErstattung = Math.max(0, warenwertBrutto - labelFeeBrutto);

  const result = await prisma.$transaction(async (tx) => {
    // RetoureCase mit Webisco-Beleg-Snapshot
    const c = await tx.retoureCase.create({
      data: {
        source,
        orderId: body.orderId ?? null,
        kategorie,
        kundenstatus,
        eligibleUntil,
        bestellnummer,
        belegId: webiscoBelegId,
        belegnummer: webiscoBelegnummer,
        belegdatum: webiscoBelegdatum,
        customerAnrede: customer.anrede ?? null,
        customerVorname: customer.vorname ?? null,
        customerName: customer.name ?? null,
        customerStrasse: customer.strasse ?? null,
        customerPlz: customer.plz ?? null,
        customerOrt: customer.ort ?? null,
        customerEmail: customer.email ?? null,
        customerTelefon: customer.telefon ?? null,
        itemsJson: JSON.stringify(body.items ?? []),
        orderPositionsJson: JSON.stringify(
          webiscoPositions.map((p) => ({
            artikelnummer: p.artikelnummer,
            hersteller: p.hersteller,
            beschreibung: p.beschreibung,
          })),
        ),
        premiumReturnJson: premiumReturn ? JSON.stringify(premiumReturn) : null,
        shippingMode,
        labelRequested,
        labelPaid,
        labelFeeBrutto,
        warenwertBrutto,
        voraussichtlicheErstattung,
        status: "angemeldet",
      },
    });

    // RetoureItem-Rows + Photo-Promotion
    const createdItems: Array<{ id: string; artikelnummer: string }> = [];
    for (const it of body.items ?? []) {
      const spec = isValidReasonCode(it.grund_code ?? "")
        ? RETURN_REASONS[it.grund_code as keyof typeof RETURN_REASONS]
        : null;

      const parsed = parseArtikelnummer(it.artikelnummer ?? "");
      const match = findWebiscoMatch(parsed.artikelnummer, parsed.positionId);
      const menge = it.menge ?? 1;

      const item = await tx.retoureItem.create({
        data: {
          caseId: c.id,
          source: "registered",
          status: "pending",
          // Webisco-enrichted Felder, mit Shop-Daten als Fallback
          artikelnummer: match?.artikelnummer ?? parsed.artikelnummer ?? null,
          hersteller: match?.hersteller ?? null,
          beschreibung: match?.beschreibung ?? null,
          menge,
          grund: it.grund_freitext ?? spec?.labelDe ?? null,
          grundCode: it.grund_code ?? null,
          grundFreitext: it.grund_freitext ?? null,
          internalFault: spec?.internalFault ?? false,
          einzelpreis_brutto: match?.einzelpreis_brutto ?? null,
          gesamtpreis_brutto:
            match?.einzelpreis_brutto != null
              ? match.einzelpreis_brutto * menge
              : null,
          einzelgewicht_g: match?.einzelgewicht_g ?? null,
          einkaufspreis_brutto: match?.einkaufspreis_brutto ?? null,
          einspeiserid: match?.einspeiserid ?? null,
        },
      });

      // Photo-IDs auf RetoureItemPhoto promoten
      for (const photoId of it.photo_ids ?? []) {
        await promoteToItemPhoto(tx, photoId, item.id, c.id);
      }

      createdItems.push({
        id: item.id,
        artikelnummer: match?.artikelnummer ?? parsed.artikelnummer ?? "",
      });
    }

    return { case: c, items: createdItems };
  });

  // ── Event-Log ─────────────────────────────────────────────────────
  await addEvent(
    result.case.id,
    "case_created",
    `Retoure angemeldet via ${source} (${result.items.length} Item(s), Kategorie ${kategorie})`,
    {
      source,
      kategorie,
      itemCount: result.items.length,
      orderId: body.orderId,
      webiscoEnriched: webiscoSkipReason === null,
      webiscoSkipReason,
      warenwertBrutto,
    },
    `shop:${source}`,
  );

  if (webiscoSkipReason) {
    await addEvent(
      result.case.id,
      "webisco_enrichment_skipped",
      `Webisco-Enrichment übersprungen: ${webiscoSkipReason}. Item-Preise + Beschreibungen fehlen — PDA-Worker muss beim Eingang nachpflegen.`,
      { reason: webiscoSkipReason },
      `shop:${source}`,
    );
  }

  // ── DHL-Label generieren (wenn vom Customer angefragt) ───────────
  // Inline (nicht async) damit die Submit-Response direkt die Label-URL
  // mitschicken kann. Bei dodajpaczke-Fehler: Case ist trotzdem angelegt,
  // wir loggen einen Event, der Shop kriegt `shippingLabel: null` zurück
  // und kann später nochmal pullen.
  let shippingLabelInfo: {
    pdfUrl: string;
    trackingCode: string;
    carrier: "DHL";
  } | null = null;

  if (labelRequested) {
    try {
      const labelResult = await createRetoureLabel({
        weightInKg: 5, // Default 5kg — wird später vom PDA bei Eingang aktualisiert
        customerReference: bestellnummer,
        description: `Retoure ${bestellnummer}`,
        customer: {
          salutation: customer.anrede ?? undefined,
          firstname: customer.vorname ?? undefined,
          lastname: customer.name ?? undefined,
          streetName: customer.strasse ?? undefined,
          zipNumber: customer.plz ?? undefined,
          city: customer.ort ?? undefined,
          countryISOCode: customer.land ?? "DE",
          email: customer.email ?? undefined,
          phone: customer.telefon ?? undefined,
        },
      });

      if (labelResult.ok) {
        await prisma.retoureCase.update({
          where: { id: result.case.id },
          data: {
            dhlShipmentId: labelResult.shipmentId,
            dhlTrackingNumber: labelResult.trackingNumber ?? null,
            dhlRetoureIdc: labelResult.retoureIdc ?? null,
            weightSentKg: 5,
          },
        });
        await addEvent(
          result.case.id,
          "label_created",
          `DHL-Label erzeugt — Tracking ${labelResult.trackingNumber ?? "?"}`,
          {
            shipmentId: labelResult.shipmentId,
            trackingNumber: labelResult.trackingNumber,
          },
          `shop:${source}`,
        );

        const baseUrl =
          process.env.RETOURE_PUBLIC_URL?.replace(/\/+$/, "") ?? "";
        shippingLabelInfo = {
          pdfUrl: `${baseUrl}/api/retoure/cases/${result.case.id}/shipping-label-pdf`,
          trackingCode: labelResult.trackingNumber ?? "",
          carrier: "DHL",
        };
      } else if ("skipped" in labelResult && labelResult.skipped) {
        // Provider nicht konfiguriert (dev/staging-Setup) — kein Fehler
        await addEvent(
          result.case.id,
          "label_skipped",
          `DHL-Label-Erzeugung übersprungen: ${labelResult.reason}`,
          { reason: labelResult.reason },
          `shop:${source}`,
        );
      } else {
        // Echter Fehler — Case bleibt aber angelegt
        await addEvent(
          result.case.id,
          "label_failed",
          `DHL-Label-Erzeugung fehlgeschlagen: ${labelResult.error}`,
          { error: labelResult.error },
          `shop:${source}`,
        );
        console.error("[submit] createRetoureLabel failed:", labelResult.error);
      }
    } catch (err) {
      // Defensive — Label-Generierung darf den Submit nicht killen
      const msg = err instanceof Error ? err.message : String(err);
      await addEvent(
        result.case.id,
        "label_failed",
        `DHL-Label-Generierung Exception: ${msg}`,
        { error: msg },
        `shop:${source}`,
      );
      console.error("[submit] createRetoureLabel exception:", err);
    }
  }

  // ── Webhook fire (async, non-blocking) ────────────────────────────
  void enqueueWebhook({
    source,
    event: "status_changed",
    caseId: result.case.id,
    payload: {
      event: "status_changed",
      caseId: result.case.id,
      bestellnummer: result.case.bestellnummer,
      orderId: result.case.orderId,
      source,
      kategorie,
      from: null,
      to: "angemeldet",
      occurredAt: new Date().toISOString(),
      customer: {
        email: customer.email,
        vorname: customer.vorname,
        name: customer.name,
      },
    },
  }).catch((err) => {
    console.error("[submit] enqueueWebhook failed:", err);
  });

  // ── Response ──────────────────────────────────────────────────────
  return NextResponse.json({
    caseId: result.case.id,
    status: result.case.status,
    createdAt: result.case.createdAt.toISOString(),
    eligibleUntil: result.case.eligibleUntil?.toISOString() ?? null,
    shippingLabel: shippingLabelInfo,
    items: result.items,
  });
}
