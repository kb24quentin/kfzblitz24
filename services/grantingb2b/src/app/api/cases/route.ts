/**
 * POST /api/cases — Programmatic case creation (z.B. aus dem Shop oder
 * externen Anfrage-Formularen). Erwartet JSON.
 *
 * Authentifizierung: Bearer-Token via Header `Authorization: Bearer <API_TOKEN>`.
 * Falls API_TOKEN nicht gesetzt ist, läuft der Endpoint im Open Mode
 * (nur für staging — in prod immer Token setzen).
 *
 * Gewerbeschein wird in diesem JSON-Endpoint NICHT aufgenommen; dafür
 * gibt es einen separaten Upload-Flow (folgt) oder die Form-Erfassung.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAssessment } from "@/lib/assess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatePayload = {
  customerType?: string;
  businessSubtype?: string | null;
  companyName?: string;
  contactFirstName?: string;
  contactLastName?: string;
  email?: string;
  phone?: string | null;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  shippingSameAsBilling?: boolean;
  shippingStreet?: string | null;
  shippingPostalCode?: string | null;
  shippingCity?: string | null;
  shippingCountry?: string | null;
  ustId?: string | null;
  externalRef?: string | null;
  // Optional: assess=false → skip automatic assessment
  assess?: boolean;
};

function authorize(req: Request): { ok: true } | { ok: false; error: string } {
  const required = process.env.API_TOKEN?.trim();
  if (!required) return { ok: true }; // open mode (staging)
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (token === required) return { ok: true };
  return { ok: false, error: "Unauthorized" };
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let payload: CreatePayload;
  try {
    payload = (await req.json()) as CreatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const customerType = s(payload.customerType).toLowerCase();
  if (!["werkstatt", "wiederverkaeufer"].includes(customerType)) {
    return NextResponse.json(
      { error: "customerType muss 'werkstatt' oder 'wiederverkaeufer' sein" },
      { status: 400 }
    );
  }
  const companyName = s(payload.companyName);
  const contactFirstName = s(payload.contactFirstName);
  const contactLastName = s(payload.contactLastName);
  const email = s(payload.email);
  const street = s(payload.street);
  const postalCode = s(payload.postalCode);
  const city = s(payload.city);
  const missing = Object.entries({
    companyName,
    contactFirstName,
    contactLastName,
    email,
    street,
    postalCode,
    city,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Pflichtfelder fehlen: ${missing.join(", ")}` },
      { status: 400 }
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email ungültig" }, { status: 400 });
  }

  const shippingSameAsBilling = payload.shippingSameAsBilling !== false;

  const created = await prisma.b2BCase.create({
    data: {
      customerType,
      businessSubtype: payload.businessSubtype || null,
      companyName,
      contactFirstName,
      contactLastName,
      email,
      phone: s(payload.phone) || null,
      street,
      postalCode,
      city,
      country: s(payload.country) || "Deutschland",
      shippingSameAsBilling,
      shippingStreet: shippingSameAsBilling ? null : s(payload.shippingStreet) || null,
      shippingPostalCode:
        shippingSameAsBilling ? null : s(payload.shippingPostalCode) || null,
      shippingCity: shippingSameAsBilling ? null : s(payload.shippingCity) || null,
      shippingCountry:
        shippingSameAsBilling ? null : s(payload.shippingCountry) || null,
      ustId: s(payload.ustId) || null,
      externalRef: s(payload.externalRef) || null,
      source: "api",
    },
  });

  await prisma.b2BCaseEvent.create({
    data: {
      caseId: created.id,
      type: "case_created",
      message: `Case angelegt für ${companyName} (via API)`,
      actor: "api",
    },
  });

  // Auto-assess (default on)
  if (payload.assess !== false) {
    try {
      await runAssessment(created.id);
    } catch (e) {
      await prisma.b2BCaseEvent.create({
        data: {
          caseId: created.id,
          type: "note",
          message: `Assessment fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
          actor: "system",
        },
      });
    }
  }

  const final = await prisma.b2BCase.findUnique({ where: { id: created.id } });

  return NextResponse.json(
    {
      ok: true,
      id: created.id,
      status: final?.status,
      score: final?.score,
      recommendation: final?.recommendation,
      url: `${process.env.APP_URL ?? ""}/cases/${created.id}`,
    },
    { status: 201 }
  );
}

export async function GET() {
  return NextResponse.json({
    name: "B2B Assessment Engine",
    endpoints: {
      "POST /api/cases": "Create a new case (JSON, optional Bearer auth)",
      "GET /api/cases/:id": "Get a case",
      "GET /api/cases/:id/gewerbeschein": "Download Gewerbeschein file",
    },
  });
}
