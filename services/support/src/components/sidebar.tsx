"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Inbox,
  Archive,
  Users,
  Settings,
  LogOut,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Tickets", href: "/tickets", icon: Inbox, matchExact: false },
  { name: "Archiv", href: "/tickets/archive", icon: Archive, matchExact: true },
  { name: "Kontakte", href: "/contacts", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-primary text-white flex flex-col">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/kfzblitz-logo.svg"
          alt="kfzblitz24"
          className="h-7 w-auto"
        />
        <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">
          Support
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : "matchExact" in item && item.matchExact
                ? pathname === item.href
                : item.href === "/tickets"
                  ? pathname.startsWith("/tickets") && !pathname.startsWith("/tickets/archive")
                  : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Settings className="w-5 h-5" />
          Einstellungen
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:bg-red-500/20 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
