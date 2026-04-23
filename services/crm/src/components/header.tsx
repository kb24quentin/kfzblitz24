"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/contacts": "Kontakte",
  "/templates": "Templates",
  "/campaigns": "Kampagnen",
  "/inbox": "Inbox",
  "/analytics": "Analytics",
  "/settings": "Einstellungen",
};

export function Header() {
  const pathname = usePathname();
  const title =
    Object.entries(pageTitles).find(
      ([path]) => path === "/" ? pathname === "/" : pathname.startsWith(path)
    )?.[1] || "kfzBlitz24 CRM";

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

        {/* Notifications */}
        <button className="relative p-2 hover:bg-bg-secondary rounded-lg transition-colors">
          <Bell className="w-5 h-5 text-text-light" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
        </button>

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-white text-sm font-bold">
            KB
          </div>
        </div>
      </div>
    </header>
  );
}
