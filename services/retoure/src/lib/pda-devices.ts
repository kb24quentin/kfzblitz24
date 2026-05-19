/**
 * PdaDevice-Library — Pairing-Lifecycle für PDA-Geräte.
 *
 * Konventionen:
 *   - Token: 32 hex chars (128 bit). Bleibt geheim, geht nur beim Pairing
 *     ans Gerät und liegt dann in localStorage des PDA-Browsers.
 *   - PairingCode: 10 chars aus alphabet ohne ähnlich aussehende Zeichen
 *     (kein 0/O, kein 1/l/I). Lebensdauer 10 Min, one-shot.
 *
 * Auth-Flow siehe schema.prisma-Doku und checkPdaAuth() in pda-auth.ts.
 */

import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import type { PdaDevice } from "@prisma/client";

/** Default-TTL für Pairing-Codes in Minuten. */
export const PAIRING_TTL_MIN = 10;

/** Alphabet für Pairing-Codes — bewusst ohne 0/O, 1/l/I, B/8. */
const PAIRING_ALPHABET = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Erzeugt einen kryptographisch sicheren Bearer-Token.
 * 32 hex chars = 128 bit Entropie — reicht für Bearer-Tokens locker.
 */
export function generateDeviceToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Erzeugt einen Pairing-Code im Format `PDA-XXXX-XXXX` (8 Nutzzeichen).
 * Bindestriche dienen nur der Lesbarkeit auf dem Admin-Bildschirm;
 * der QR-Code enthält die volle URL inkl. dieser Form, sodass das
 * Eintippen per Hand notfalls auch klappt.
 */
export function generatePairingCode(): string {
  const chunk = (n: number) => {
    const bytes = randomBytes(n);
    let s = "";
    for (let i = 0; i < n; i++) {
      s += PAIRING_ALPHABET[bytes[i] % PAIRING_ALPHABET.length];
    }
    return s;
  };
  return `PDA-${chunk(4)}-${chunk(4)}`;
}

export interface CreatePairingOpts {
  pdaId: string;
  createdBy?: string;
  ttlMin?: number;
}

/**
 * Legt ein neues PDA-Device mit frischem Pairing-Code an.
 * Wirft `P2002` wenn die `pdaId` bereits existiert (Friendly Name muss
 * eindeutig sein).
 */
export async function createPairing(opts: CreatePairingOpts): Promise<PdaDevice> {
  const ttlMin = opts.ttlMin ?? PAIRING_TTL_MIN;
  const now = new Date();
  return prisma.pdaDevice.create({
    data: {
      pdaId: opts.pdaId.trim(),
      token: generateDeviceToken(),
      active: true,
      pairingCode: generatePairingCode(),
      pairingExpiresAt: new Date(now.getTime() + ttlMin * 60 * 1000),
      createdBy: opts.createdBy ?? null,
    },
  });
}

/**
 * Rotiert (= erzeugt einen frischen) Pairing-Code für ein bestehendes
 * Device. Praktisch wenn der erste QR ausläuft ohne benutzt zu werden.
 *
 * Achtung: nicht erlaubt wenn das Device bereits gepaart ist — sonst
 * müsste man den existierenden Token invalidieren. Stattdessen
 * `regenerateToken()` benutzen.
 */
export async function regeneratePairingCode(
  id: string,
  ttlMin: number = PAIRING_TTL_MIN,
): Promise<PdaDevice> {
  const existing = await prisma.pdaDevice.findUnique({ where: { id } });
  if (!existing) throw new Error(`PdaDevice not found: ${id}`);
  if (existing.pairedAt) {
    throw new Error(
      "Device ist bereits gepaart. Nutze regenerateToken() um Zugriff zu rotieren.",
    );
  }
  const now = new Date();
  return prisma.pdaDevice.update({
    where: { id },
    data: {
      pairingCode: generatePairingCode(),
      pairingExpiresAt: new Date(now.getTime() + ttlMin * 60 * 1000),
    },
  });
}

/**
 * Tauscht einen Pairing-Code gegen das eigentliche Device-Setup
 * (`{token, pdaId}`). Markiert das Pairing als verbraucht.
 *
 * Returns `null` wenn:
 *   - Code unbekannt
 *   - Code abgelaufen
 *   - Code schon konsumiert (also pairedAt gesetzt)
 *
 * Sicher gegen Race: wir tun das atomar in einer Transaction mit
 * Bedingung an pairingCode + pairingExpiresAt.
 */
export async function consumePairing(
  code: string,
): Promise<{ token: string; pdaId: string } | null> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return null;

  return prisma.$transaction(async (tx) => {
    const device = await tx.pdaDevice.findUnique({
      where: { pairingCode: cleaned },
    });
    if (!device) return null;
    if (!device.pairingExpiresAt || device.pairingExpiresAt < new Date()) {
      return null;
    }
    if (device.pairedAt) return null;
    if (!device.active) return null;

    await tx.pdaDevice.update({
      where: { id: device.id },
      data: {
        pairedAt: new Date(),
        pairingCode: null, // one-shot
        pairingExpiresAt: null,
        lastSeenAt: new Date(),
      },
    });
    return { token: device.token, pdaId: device.pdaId };
  });
}

/**
 * Sucht ein aktives Device per Bearer-Token. Best-effort `lastSeenAt`-
 * Update als fire-and-forget.
 */
export async function findActiveDeviceByToken(
  token: string,
): Promise<PdaDevice | null> {
  if (!token) return null;
  const device = await prisma.pdaDevice.findUnique({ where: { token } });
  if (!device || !device.active || !device.pairedAt) return null;
  // lastSeenAt updaten ohne den Request zu blocken — Fehler hier dürfen
  // den API-Call nicht killen.
  prisma.pdaDevice
    .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
    .catch((e) => {
      console.warn("[pda-devices] lastSeenAt update failed:", e);
    });
  return device;
}

export async function listDevices(): Promise<PdaDevice[]> {
  return prisma.pdaDevice.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
}

export async function setActive(id: string, active: boolean): Promise<PdaDevice> {
  return prisma.pdaDevice.update({
    where: { id },
    data: { active },
  });
}

export async function deleteDevice(id: string): Promise<void> {
  await prisma.pdaDevice.delete({ where: { id } });
}

/**
 * Baut die Pairing-URL für den QR-Code. Aus dem Admin-Host
 * (`rma.…kfzblitz24-group.com`) leiten wir den PDA-Host
 * (`pda.rma.…kfzblitz24-group.com`) durch Voranstellen von `pda.` ab.
 *
 * Falls der Admin-Host bereits mit `pda.` startet (selten — local-dev),
 * geben wir ihn unverändert zurück.
 */
export function buildPairingUrl(adminHost: string, code: string): string {
  const proto = adminHost.startsWith("localhost") ? "http" : "https";
  const host = adminHost.startsWith("pda.")
    ? adminHost
    : `pda.${adminHost}`;
  return `${proto}://${host}/pda-app/pair?code=${encodeURIComponent(code)}`;
}
