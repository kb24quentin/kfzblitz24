import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  variable: "--font-rubik",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "kfzBlitz24 Intranet",
  description: "Internes Portal fuer kfzBlitz24 Mitarbeiter",
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
