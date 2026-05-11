import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import Link from "next/link";
import { ShieldCheck, Plus, List as ListIcon } from "lucide-react";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  variable: "--font-rubik",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "B2B Assessment Engine – kfzBlitz24",
  description:
    "Automatisierte Prüfung & Freigabe von B2B-Kundenanfragen (Werkstätten & Wiederverkäufer).",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`h-full ${rubik.variable}`}>
      <body className="h-full" style={{ fontFamily: "'Rubik', sans-serif" }}>
        <div className="min-h-full">
          <header className="bg-white border-b border-border">
            <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
              <Link href="/" className="flex items-center gap-2 text-text font-semibold">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <span>B2B Assessment Engine</span>
                <span className="text-xs font-medium text-text-light bg-bg-secondary border border-border rounded px-1.5 py-0.5 ml-1">
                  staging
                </span>
              </Link>
              <nav className="flex items-center gap-1">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-text-light hover:bg-bg-secondary hover:text-text"
                >
                  <ListIcon className="w-4 h-4" /> Cases
                </Link>
                <Link
                  href="/new"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-accent text-white hover:bg-accent-light"
                >
                  <Plus className="w-4 h-4" /> Neuer Case
                </Link>
              </nav>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
