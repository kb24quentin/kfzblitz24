import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "kfzBlitz24 PDA",
  description: "Lager-PDA-App für Retoure-Annahme und -Bearbeitung",
  manifest: undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b3756",
};

export default function PdaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b3756] text-white">
      <header className="sticky top-0 z-10 bg-[#0b3756] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <a href="/pda-app" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-white">kfz</span>
            <span className="text-[#ff6600]">blitz</span>
            <span className="text-white">24</span>
          </span>
          <span className="text-xs text-white/60 uppercase tracking-wider">PDA</span>
        </a>
        <a
          href="/pda-app/settings"
          aria-label="Einstellungen"
          className="text-white/80 hover:text-white text-xs px-2 py-1 rounded"
        >
          Einst.
        </a>
      </header>
      <main className="p-4 pb-24 max-w-md mx-auto">{children}</main>
    </div>
  );
}
