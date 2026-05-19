export const dynamic = "force-dynamic";

import Link from "next/link";
import { Smartphone, Plus, CheckCircle2, Clock, Ban } from "lucide-react";
import { listDevices } from "@/lib/pda-devices";

export default async function PdaDevicesPage() {
  const devices = await listDevices();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b3756] flex items-center gap-2">
            <Smartphone className="w-6 h-6" /> PDA-Geräte
          </h1>
          <p className="text-sm text-[#8a93a0] mt-1">
            Pro PDA ein eigener Bearer-Token. Pairing per QR-Code — Mitarbeiter
            scannt mit dem PDA-Scanner, App ist sofort eingerichtet.
          </p>
        </div>
        <Link
          href="/admin/pda-devices/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff6600] text-white text-sm font-semibold rounded-lg hover:bg-[#e65a00]"
        >
          <Plus className="w-4 h-4" /> Neues PDA
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#e6e8eb] overflow-hidden">
        {devices.length === 0 ? (
          <div className="p-12 text-center">
            <Smartphone className="w-12 h-12 mx-auto text-[#8a93a0] mb-3" />
            <p className="text-[#3d4654] font-medium">
              Noch keine PDA-Geräte gepairt
            </p>
            <p className="text-sm text-[#8a93a0] mt-1">
              Tippe „Neues PDA" um den ersten Pairing-Code zu erzeugen.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f4f5f7] border-b border-[#e6e8eb]">
              <tr className="text-left text-xs font-semibold text-[#8a93a0] uppercase tracking-wide">
                <th className="px-4 py-3">PDA-ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Zuletzt gesehen</th>
                <th className="px-4 py-3">Angelegt</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e8eb]">
              {devices.map((d) => {
                const isPaired = !!d.pairedAt;
                const isPending = !isPaired && !!d.pairingCode;
                const isExpiredPairing =
                  isPending &&
                  d.pairingExpiresAt != null &&
                  d.pairingExpiresAt < new Date();
                return (
                  <tr key={d.id} className="hover:bg-[#f4f5f7]/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/pda-devices/${d.id}`}
                        className="font-mono text-[#0b3756] font-semibold hover:underline"
                      >
                        {d.pdaId}
                      </Link>
                      {d.createdBy && (
                        <div className="text-[10px] text-[#8a93a0] mt-0.5">
                          angelegt von {d.createdBy}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!d.active ? (
                        <Chip color="red" icon={<Ban className="w-3 h-3" />}>
                          Deaktiviert
                        </Chip>
                      ) : isPaired ? (
                        <Chip
                          color="green"
                          icon={<CheckCircle2 className="w-3 h-3" />}
                        >
                          Gepairt
                        </Chip>
                      ) : isExpiredPairing ? (
                        <Chip color="gray">Code abgelaufen</Chip>
                      ) : isPending ? (
                        <Chip
                          color="orange"
                          icon={<Clock className="w-3 h-3" />}
                        >
                          Warten auf Scan
                        </Chip>
                      ) : (
                        <Chip color="gray">—</Chip>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#3d4654]">
                      {d.lastSeenAt
                        ? d.lastSeenAt.toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8a93a0]">
                      {d.createdAt.toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/pda-devices/${d.id}`}
                        className="text-xs text-[#0b3756] hover:underline"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Chip({
  color,
  icon,
  children,
}: {
  color: "green" | "orange" | "red" | "gray";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles =
    color === "green"
      ? "bg-green-100 text-green-800"
      : color === "orange"
        ? "bg-[#ff6600]/15 text-[#ff6600]"
        : color === "red"
          ? "bg-red-100 text-red-800"
          : "bg-[#e6e8eb] text-[#3d4654]";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${styles}`}
    >
      {icon}
      {children}
    </span>
  );
}
