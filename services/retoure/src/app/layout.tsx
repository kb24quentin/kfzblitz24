import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kfzBlitz24",
  description: "kfzBlitz24 Retouren-Plattform",
};

/**
 * Minimaler Root-Layout — keine Chrome, keine Container-Constraints.
 * Jede Route-Group bringt ihr eigenes Layout mit:
 *
 * - (customer)/layout.tsx → schmaler Header, max-w-4xl, Footer für das Kunden-Portal
 * - admin/layout.tsx      → breiter Navy-Header, voller Width fürs Dashboard
 * - login/page.tsx        → full-bleed Navy-Hintergrund
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-[#f4f5f7] text-[#3d4654] antialiased">{children}</body>
    </html>
  );
}
