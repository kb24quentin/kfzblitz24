"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/contacts": "Kontakte",
  "/templates": "Templates",
  "/campaigns": "Kampagnen",
  "/analytics": "Analytics",
  "/settings": "Einstellungen",
};

export function HeaderClient({ userName }: { userName: string }) {
  const pathname = usePathname();
  const title =
    Object.entries(pageTitles).find(
      ([path]) => (path === "/" ? pathname === "/" : pathname.startsWith(path))
    )?.[1] || "kfzBlitz24 CRM";

  const firstName = userName.split(" ")[0] || userName;

  return (
    <header className="sticky top-0 z-30 bg-bg-card border-b border-border px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-bold text-text">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
          <input
            type="text"
            placeholder="Suchen..."
            className="pl-9 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent w-64"
          />
        </div>

        {/* Welcome */}
        {firstName && (
          <div className="text-sm text-text-light">
            Willkommen, <span className="font-medium text-text">{firstName}</span>
          </div>
        )}
      </div>
    </header>
  );
}
