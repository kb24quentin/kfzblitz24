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
  abholung_gewuenscht?: boolean;
}

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

  // ── Case + Items anlegen ──────────────────────────────────────────
  const customer = body.customer ?? {};
  const eligibleUntil = elig.eligibleUntil ?? computeEligibleUntil(new Date(), kategorie);

  const result = await prisma.$transaction(async (tx) => {
    // RetoureCase
    const c = await tx.retoureCase.create({
      data: {
        source,
        orderId: body.orderId ?? null,
        kategorie,
        kundenstatus,
        eligibleUntil,
        bestellnummer,
        customerAnrede: customer.anrede ?? null,
        customerVorname: customer.vorname ?? null,
        customerName: customer.name ?? null,
        customerStrasse: customer.strasse ?? null,
        customerPlz: customer.plz ?? null,
        customerOrt: customer.ort ?? null,
        customerEmail: customer.email ?? null,
        customerTelefon: customer.telefon ?? null,
        itemsJson: JSON.stringify(body.items ?? []),
        status: "angemeldet",
      },
    });

    // RetoureItem-Rows + Photo-Promotion
    const createdItems: Array<{ id: string; artikelnummer: string }> = [];
    for (const it of body.items ?? []) {
      const spec = isValidReasonCode(it.grund_code ?? "")
        ? RETURN_REASONS[it.grund_code as keyof typeof RETURN_REASONS]
        : null;

      const item = await tx.retoureItem.create({
        data: {
          caseId: c.id,
          source: "registered",
          status: "pending",
          artikelnummer: it.artikelnummer ?? null,
          menge: it.menge ?? 1,
          grund: it.grund_freitext ?? spec?.labelDe ?? null,
          grundCode: it.grund_code ?? null,
          grundFreitext: it.grund_freitext ?? null,
          internalFault: spec?.internalFault ?? false,
        },
      });

      // Photo-IDs auf RetoureItemPhoto promoten
      for (const photoId of it.photo_ids ?? []) {
        await promoteToItemPhoto(tx, photoId, item.id, c.id);
      }

      createdItems.push({
        id: item.id,
        artikelnummer: it.artikelnummer ?? "",
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
    },
    `shop:${source}`,
  );

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
    shippingLabel: null, // wird async generiert, Shop pullt via /shipping-label-pdf
    items: result.items,
  });
}
