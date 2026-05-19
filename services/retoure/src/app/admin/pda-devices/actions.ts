"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createPairing,
  regeneratePairingCode,
  deleteDevice,
  setActive,
} from "@/lib/pda-devices";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Nicht eingeloggt");
  return session.user;
}

/**
 * Legt ein neues PDA-Gerät an + frischen Pairing-Code. Leitet auf die
 * Detail-Seite weiter, wo der Admin den QR sieht.
 */
export async function createPairingAction(formData: FormData) {
  const user = await requireUser();
  const pdaId = String(formData.get("pdaId") ?? "").trim();
  if (!pdaId) throw new Error("pdaId fehlt");
  if (pdaId.length > 60) throw new Error("pdaId zu lang (max. 60 Zeichen)");

  let device;
  try {
    device = await createPairing({
      pdaId,
      createdBy: user.email ?? undefined,
    });
  } catch (err: unknown) {
    // P2002 = Unique constraint violation (pdaId schon vergeben)
    const code = (err as { code?: string } | null)?.code ?? "";
    if (code === "P2002") {
      throw new Error(`PDA-ID "${pdaId}" existiert bereits — bitte anderen Namen wählen`);
    }
    throw err;
  }
  revalidatePath("/admin/pda-devices");
  redirect(`/admin/pda-devices/${device.id}`);
}

/**
 * Erzeugt einen frischen Pairing-Code für ein noch nicht gepaartes
 * Device. Bei bereits gepaartem Device wirft die Lib einen Fehler.
 */
export async function regenerateCodeAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("id fehlt");
  await regeneratePairingCode(id);
  revalidatePath("/admin/pda-devices");
  revalidatePath(`/admin/pda-devices/${id}`);
}

export async function toggleActiveAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  const newActive = formData.get("active") === "true";
  if (!id) throw new Error("id fehlt");
  await setActive(id, newActive);
  revalidatePath("/admin/pda-devices");
  revalidatePath(`/admin/pda-devices/${id}`);
}

export async function deleteDeviceAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("id fehlt");
  await deleteDevice(id);
  revalidatePath("/admin/pda-devices");
  redirect("/admin/pda-devices");
}
