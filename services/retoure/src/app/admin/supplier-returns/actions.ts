"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createSupplierReturn,
  markShipped,
  markReceivedAtSupplier,
  markRefunded,
  markRejected,
} from "@/lib/suppliers";
import {
  supplierReturnLabelZpl,
  sendZplToPrinter,
} from "@/lib/label-print";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nicht eingeloggt");
  return session.user;
}

/**
 * Versucht (best-effort) ein Lieferanten-Retoure-Label auf den ZPL-Drucker
 * zu schicken. Fehler werden geschluckt — der Anlage-Flow darf daran nicht
 * scheitern (gem. Aufgaben-Vorgabe). Drucker-IP kommt aus `PRINTER_HOST`.
 */
async function tryPrintSupplierLabel(returnId: string): Promise<void> {
  const host = process.env.PRINTER_HOST?.trim();
  if (!host) return;

  try {
    const r = await prisma.supplierReturn.findUnique({
      where: { id: returnId },
      include: { supplier: true },
    });
    if (!r) return;

    // Wenn ein Container hängt, ziehen wir uns aus dessen ersten Item den
    // dazugehörigen Case (bestellnummer) — das ist die Identifikation,
    // unter der der Lieferant die Ware kennt. Fallback: Return-ID selbst.
    let caseId = r.id;
    let bestellnummer = "—";
    if (r.containerId) {
      const item = await prisma.retoureItem.findFirst({
        where: { containerId: r.containerId },
        include: { case: true },
      });
      if (item) {
        caseId = item.case.id;
        bestellnummer = item.case.bestellnummer;
      }
    }

    const addressLines = [
      r.supplier.street,
      [r.supplier.postalCode, r.supplier.city].filter(Boolean).join(" "),
      r.supplier.country,
    ]
      .filter((s) => s && s.trim())
      .join("\n");

    const zpl = supplierReturnLabelZpl({
      caseId,
      bestellnummer,
      supplierName: r.supplier.name,
      supplierAddress: addressLines || r.supplier.country,
    });

    await sendZplToPrinter(zpl, host);
  } catch {
    // bewusst geschluckt — Print-Fehler dürfen den Anlage-Flow nicht brechen.
  }
}

export async function createSupplierReturnAction(formData: FormData) {
  await requireUser();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const containerId = String(formData.get("containerId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!supplierId) {
    throw new Error("Lieferant ist Pflichtfeld");
  }
  const r = await createSupplierReturn({ supplierId, containerId, notes });
  await tryPrintSupplierLabel(r.id);
  revalidatePath("/admin/supplier-returns");
  revalidatePath(`/admin/suppliers/${supplierId}`);
  redirect(`/admin/supplier-returns/${r.id}`);
}

export async function markShippedAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const tracking = String(formData.get("trackingNumber") ?? "").trim();
  if (!id) throw new Error("Return-ID fehlt");
  if (!tracking) throw new Error("Tracking-Nummer fehlt");
  await markShipped(id, tracking, user.email ?? "admin");
  revalidatePath("/admin/supplier-returns");
  revalidatePath(`/admin/supplier-returns/${id}`);
}

export async function markReceivedAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Return-ID fehlt");
  await markReceivedAtSupplier(id, user.email ?? "admin");
  revalidatePath("/admin/supplier-returns");
  revalidatePath(`/admin/supplier-returns/${id}`);
}

export async function markRefundedAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const amountRaw = String(formData.get("refundAmount") ?? "")
    .replace(",", ".")
    .trim();
  if (!id) throw new Error("Return-ID fehlt");
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Gutschrift-Betrag ungültig");
  }
  await markRefunded(id, amount, user.email ?? "admin");
  revalidatePath("/admin/supplier-returns");
  revalidatePath(`/admin/supplier-returns/${id}`);
}

export async function markRejectedAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) throw new Error("Return-ID fehlt");
  await markRejected(id, user.email ?? "admin", notes || undefined);
  revalidatePath("/admin/supplier-returns");
  revalidatePath(`/admin/supplier-returns/${id}`);
}

export async function updateNotesAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!id) throw new Error("Return-ID fehlt");
  await prisma.supplierReturn.update({
    where: { id },
    data: { notes },
  });
  revalidatePath(`/admin/supplier-returns/${id}`);
}
