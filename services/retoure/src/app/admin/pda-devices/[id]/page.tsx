export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Smartphone,
  CheckCircle2,
  Clock,
  Ban,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { buildPairingUrl } from "@/lib/pda-devices";
import {
  regenerateCodeAction,
  toggleActiveAction,
  deleteDeviceAction,
} from "../actions";
import { PairingCountdown } from "./countdown";

export default async function PdaDeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const device = await prisma.pdaDevice.findUnique({ where: { id } });
  if (!device) notFound();

  const isPaired = !!device.pairedAt;
  const hasActiveCode =
    !isPaired &&
    !!device.pairingCode &&
    !!device.pairingExpiresAt &&
    device.pairingExpiresAt > new Date();

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "rma.kfzblitz24-group.com";
  const pairingUrl = device.pairingCode
    ? buildPairingUrl(host, device.pairingCode)
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/admin/pda-devices"
        className="inline-flex items-center gap-1.5 text-sm text-[#0b3756] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Alle PDA-Geräte
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b3756] flex items-center gap-2">
            <Smartphone className="w-6 h-6" />
            <span className="font-mono">{device.pdaId}</span>
          </h1>
          <p className="text-sm text-[#8a93a0] mt-1">
            {device.createdBy && <>Angelegt von {device.createdBy} · </>}
            {device.createdAt.toLocaleString("de-DE")}
          </p>
        </div>
        <StatusChip
          active={device.active}
          paired={isPaired}
          hasActiveCode={hasActiveCode}
        />
      </header>

      {/* Pairing-Sektion */}
      {!isPaired && hasActiveCode && pairingUrl && (
        <section className="bg-white rounded-xl border-2 border-[#ff6600]/40 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#0b3756]">
              Mit dem PDA-Scanner pairen
            </h2>
            <p className="text-sm text-[#3d4654] mt-1">
              Auf dem PDA Chrome öffnen, Adresszeile fokussieren, den
              QR-Code unten mit dem Q900-Scanner scannen — die App pairt
              sich automatisch.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="bg-white border border-[#e6e8eb] rounded-lg p-3 shrink-0">
              {/* PNG-Endpoint — cache-busting query damit Browser nicht
                  einen alten QR aus dem letzten Regenerate cacht. */}
              <img
                src={`/api/admin/pda-devices/${device.id}/qr?v=${device.pairingExpiresAt?.getTime()}`}
                alt="Pairing QR Code"
                width={250}
                height={250}
                className="block"
              />
            </div>

            <div className="flex-1 space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8a93a0] font-semibold">
                  Pairing-Code
                </p>
                <p className="font-mono text-xl font-bold text-[#0b3756] mt-0.5">
                  {device.pairingCode}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-[#8a93a0] font-semibold">
                  URL
                </p>
                <p className="font-mono text-xs text-[#3d4654] mt-0.5 break-all">
                  {pairingUrl}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-[#8a93a0] font-semibold">
                  Gültig bis
                </p>
                <PairingCountdown
                  expiresAt={device.pairingExpiresAt!.toISOString()}
                />
              </div>

              <form action={regenerateCodeAction}>
                <input type="hidden" name="id" value={device.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b3756] text-white text-xs font-medium rounded-lg hover:bg-[#0e3f63]"
                >
                  <RefreshCw className="w-3 h-3" /> Neuen Code generieren
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Code abgelaufen — Regenerate-Knopf */}
      {!isPaired && !hasActiveCode && (
        <section className="bg-yellow-50 rounded-xl border border-yellow-200 p-5 space-y-3">
          <p className="text-sm text-yellow-900">
            Es gibt aktuell keinen aktiven Pairing-Code für dieses Gerät —
            entweder noch nicht erzeugt oder abgelaufen (10 Min TTL).
          </p>
          <form action={regenerateCodeAction}>
            <input type="hidden" name="id" value={device.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff6600] text-white text-sm font-medium rounded-lg hover:bg-[#e65a00]"
            >
              <RefreshCw className="w-4 h-4" /> Pairing-Code generieren
            </button>
          </form>
        </section>
      )}

      {/* Gepairt — Anzeige + Deactivate/Delete */}
      {isPaired && (
        <section className="bg-white rounded-xl border border-[#e6e8eb] p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-semibold">
              Gepairt am {device.pairedAt!.toLocaleString("de-DE")}
            </p>
          </div>
          {device.lastSeenAt && (
            <p className="text-sm text-[#3d4654]">
              Zuletzt gesehen:{" "}
              <span className="font-medium">
                {device.lastSeenAt.toLocaleString("de-DE")}
              </span>
            </p>
          )}
        </section>
      )}

      {/* Aktionen */}
      <section className="bg-white rounded-xl border border-[#e6e8eb] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#0b3756] uppercase tracking-wide">
          Aktionen
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <form action={toggleActiveAction}>
            <input type="hidden" name="id" value={device.id} />
            <input
              type="hidden"
              name="active"
              value={String(!device.active)}
            />
            <button
              type="submit"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg ${
                device.active
                  ? "bg-yellow-100 text-yellow-900 hover:bg-yellow-200"
                  : "bg-green-100 text-green-900 hover:bg-green-200"
              }`}
            >
              {device.active ? (
                <>
                  <Ban className="w-4 h-4" /> Deaktivieren (Token sperren)
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Wieder aktivieren
                </>
              )}
            </button>
          </form>

          <form action={deleteDeviceAction}>
            <input type="hidden" name="id" value={device.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-900 text-sm font-medium rounded-lg hover:bg-red-200"
            >
              <Trash2 className="w-4 h-4" /> Löschen
            </button>
          </form>
        </div>
        <p className="text-xs text-[#8a93a0]">
          Deaktivieren sperrt das PDA-Token sofort (z. B. bei Verlust).
          Löschen entfernt das Device vollständig — Audit-Einträge mit
          <span className="font-mono"> actor=&quot;pda:{device.pdaId}&quot;</span>
          bleiben erhalten.
        </p>
      </section>
    </div>
  );
}

function StatusChip({
  active,
  paired,
  hasActiveCode,
}: {
  active: boolean;
  paired: boolean;
  hasActiveCode: boolean;
}) {
  if (!active) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
        <Ban className="w-3.5 h-3.5" /> Deaktiviert
      </span>
    );
  }
  if (paired) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        <CheckCircle2 className="w-3.5 h-3.5" /> Gepairt
      </span>
    );
  }
  if (hasActiveCode) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-[#ff6600]/15 text-[#ff6600]">
        <Clock className="w-3.5 h-3.5" /> Warten auf Scan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-[#e6e8eb] text-[#3d4654]">
      Code abgelaufen
    </span>
  );
}
