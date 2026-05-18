import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Retourenportal — kfzblitz24",
  description: "Artikel und Bestellungen für Retouren suchen",
};

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="bg-primary text-white">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kfzblitz-logo.svg" alt="kfzblitz24" className="h-8 w-auto" />
          <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">
            Retouren
          </span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
      <footer className="max-w-4xl mx-auto px-6 py-8 text-xs text-text-light text-center">
        Beta — technischer Prototyp
      </footer>
    </div>
  );
}
