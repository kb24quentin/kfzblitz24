import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createPairingAction } from "../actions";

export default function NewPdaDevicePage() {
  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href="/admin/pda-devices"
        className="inline-flex items-center gap-1.5 text-sm text-[#0b3756] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Zurück
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-[#0b3756]">Neues PDA-Gerät</h1>
        <p className="text-sm text-[#8a93a0] mt-1">
          Vergib einen Friendly Name. Beim Speichern bekommst du einen
          QR-Code — den Code scannt der Mitarbeiter mit dem PDA-Scanner
          auf der App-Pair-Seite, fertig.
        </p>
      </header>

      <form
        action={createPairingAction}
        className="bg-white rounded-xl border border-[#e6e8eb] p-6 space-y-5"
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#8a93a0]">
            PDA-ID <span className="text-[#ff6600]">*</span>
          </span>
          <input
            autoFocus
            name="pdaId"
            required
            maxLength={60}
            placeholder="z. B. Lager-Nord, pda-01"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-[#e6e8eb] bg-white text-sm text-[#3d4654] focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40 font-mono"
          />
          <p className="text-xs text-[#8a93a0] mt-1">
            Erscheint in Audit-Logs als <span className="font-mono">actor=&quot;pda:&lt;ID&gt;&quot;</span>.
            Eindeutig pro Gerät — gib dem Mitarbeiter einen Namen, den er
            sich merken kann.
          </p>
        </label>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e6e8eb]">
          <Link
            href="/admin/pda-devices"
            className="px-4 py-2 text-sm text-[#3d4654] hover:text-[#0b3756]"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-[#ff6600] text-white text-sm font-medium rounded-lg hover:bg-[#e65a00]"
          >
            Pairing-Code erzeugen
          </button>
        </div>
      </form>
    </div>
  );
}
