import Link from "next/link";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { LayoutDashboard, LogOut } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      {/* Top bar */}
      <header className="bg-[#0b3756] text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight">
                <span className="text-white">kfz</span>
                <span className="text-[#ff6600]">blitz</span>
                <span className="text-white">24</span>
              </span>
              <span className="text-white/60 text-sm">· Retouren-Dashboard</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md hover:bg-white/10 inline-flex items-center gap-1.5"
              >
                <LayoutDashboard className="w-4 h-4" /> Cases
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-white/70">{session?.user?.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
