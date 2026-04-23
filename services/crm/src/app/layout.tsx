import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  variable: "--font-rubik",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "kfzBlitz24 CRM - Acquirer",
  description: "Internes Cold Outreach CRM fuer kfzBlitz24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`h-full ${rubik.variable}`}>
      <body className="h-full" style={{ fontFamily: "'Rubik', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
