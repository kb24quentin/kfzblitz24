/**
 * Persistenz-Helfer für Supplier + SupplierReturn (Phase 7).
 *
 * Wird vom Admin-UI über Server-Actions sowie vom Container-Workflow
 * aufgerufen, sobald eine Palette an einen Lieferanten retourniert wird.
 *
 * Konvention analog zu `retoure-cases.ts`:
 *   - alle State-Übergänge schreiben einen RetoureEvent-Eintrag, sofern
 *     ein Container (und damit ein zugeordneter Case) bekannt ist.
 *     SupplierReturns ohne Container werden mangels Case-Bindung nicht
 *     ins RetoureEvent-Log gespiegelt — der Lebenszyklus ist über die
 *     Timestamp-Felder (shippedAt / receivedAt / refundedAt) und das
 *     `status`-Feld jederzeit nachvollziehbar.
 */

import type { Supplier, SupplierReturn } from "@prisma/client";
import { prisma } from "./db";

// ---------------------------------------------------------------------------
// Status-Konstanten
// ---------------------------------------------------------------------------

/** Erlaubte Status-Werte einer SupplierReturn-Zeile. */
export const SUPPLIER_RETURN_STATUSES = [
  "vorbereitet",
  "versandt",
  "bei_lieferant",
  "gutschrift_erhalten",
  "abgelehnt",
] as const;

export type SupplierReturnStatus = (typeof SUPPLIER_RETURN_STATUSES)[number];

// ---------------------------------------------------------------------------
// Supplier — CRUD
// ---------------------------------------------------------------------------

export interface SupplierInput {
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string;
  rmaPolicy?: string | null;
  defaultLeadDays?: number;
  active?: boolean;
}

/**
 * Legt einen neuen Lieferanten an. Wirft, wenn `name` schon existiert
 * (`@unique` constraint). Leere Strings werden zu `null` normalisiert,
 * damit der Datensatz konsistent bleibt.
 */
export async function createSupplier(data: SupplierInput): Promise<Supplier> {
  return prisma.supplier.create({
    data: {
      name: data.name.trim(),
      contactPerson: nullify(data.contactPerson),
      email: nullify(data.email),
      phone: nullify(data.phone),
      street: nullify(data.street),
      postalCode: nullify(data.postalCode),
      city: nullify(data.city),
      country: (data.country ?? "DE").trim() || "DE",
      rmaPolicy: nullify(data.rmaPolicy),
      defaultLeadDays:
        typeof data.defaultLeadDays === "number" && data.defaultLeadDays > 0
          ? Math.floor(data.defaultLeadDays)
          : 30,
      active: data.active ?? true,
    },
  });
}

/**
 * Aktualisiert einen Lieferanten. Felder, die in `data` `undefined` sind,
 * bleiben unverändert; explizit gesetzte `null`-Werte löschen das Feld.
 */
export async function updateSupplier(
  id: string,
  data: Partial<SupplierInput>
): Promise<Supplier> {
  return prisma.supplier.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.contactPerson !== undefined && {
        contactPerson: nullify(data.contactPerson),
      }),
      ...(data.email !== undefined && { email: nullify(data.email) }),
      ...(data.phone !== undefined && { phone: nullify(data.phone) }),
      ...(data.street !== undefined && { street: nullify(data.street) }),
      ...(data.postalCode !== undefined && {
        postalCode: nullify(data.postalCode),
      }),
      ...(data.city !== undefined && { city: nullify(data.city) }),
      ...(data.country !== undefined && {
        country: (data.country ?? "DE").trim() || "DE",
      }),
      ...(data.rmaPolicy !== undefined && {
        rmaPolicy: nullify(data.rmaPolicy),
      }),
      ...(data.defaultLeadDays !== undefined && {
        defaultLeadDays:
          typeof data.defaultLeadDays === "number" && data.defaultLeadDays > 0
            ? Math.floor(data.defaultLeadDays)
            : 30,
      }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
}

/** Liefert alle aktiven Lieferanten, alphabetisch nach Name. */
export async function listActiveSuppliers(): Promise<Supplier[]> {
  return prisma.supplier.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

// ---------------------------------------------------------------------------
// SupplierReturn — Lebenszyklus
// ---------------------------------------------------------------------------

export interface CreateSupplierReturnInput {
  supplierId: string;
  containerId?: string | null;
  notes?: string | null;
}

/**
 * Legt eine SupplierReturn an (`status = "vorbereitet"`). Validiert dabei,
 * dass der Lieferant existiert — andernfalls wirft Prisma den FK-Fehler.
 */
export async function createSupplierReturn(
  opts: CreateSupplierReturnInput
): Promise<SupplierReturn> {
  return prisma.supplierReturn.create({
    data: {
      supplierId: opts.supplierId,
      containerId: nullify(opts.containerId),
      notes: nullify(opts.notes),
      status: "vorbereitet",
    },
  });
}

/**
 * Markiert eine SupplierReturn als versandt: speichert Tracking-Nummer
 * + Zeitstempel und setzt den Status. `actor` wird zwar entgegengenommen,
 * findet aber nur dann Verwendung, wenn der Container an Cases hängt
 * (siehe Modul-Doc) — in diesem Lib-Modul protokollieren wir die Aktion
 * absichtlich nicht ins RetoureEvent-Log.
 */
export async function markShipped(
  returnId: string,
  trackingNumber: string,
  _actor: string
): Promise<SupplierReturn> {
  return prisma.supplierReturn.update({
    where: { id: returnId },
    data: {
      trackingNumber: trackingNumber.trim() || null,
      shippedAt: new Date(),
      status: "versandt",
    },
  });
}

/** Markiert: Sendung beim Lieferanten eingegangen. */
export async function markReceivedAtSupplier(
  returnId: string,
  _actor: string
): Promise<SupplierReturn> {
  return prisma.supplierReturn.update({
    where: { id: returnId },
    data: {
      receivedAt: new Date(),
      status: "bei_lieferant",
    },
  });
}

/** Markiert: Gutschrift vom Lieferanten erhalten. */
export async function markRefunded(
  returnId: string,
  amount: number,
  _actor: string
): Promise<SupplierReturn> {
  return prisma.supplierReturn.update({
    where: { id: returnId },
    data: {
      refundAmount: Number.isFinite(amount) ? amount : null,
      refundedAt: new Date(),
      status: "gutschrift_erhalten",
    },
  });
}

/** Markiert: Lieferant hat die Retoure abgelehnt. */
export async function markRejected(
  returnId: string,
  _actor: string,
  notes?: string
): Promise<SupplierReturn> {
  return prisma.supplierReturn.update({
    where: { id: returnId },
    data: {
      status: "abgelehnt",
      ...(notes !== undefined && { notes: nullify(notes) }),
    },
  });
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Trim + leeres String → null. Erhält explizit gesetztes `null`. */
function nullify(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return v ?? null;
  const t = v.trim();
  return t === "" ? null : t;
}
