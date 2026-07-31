import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { prisma } from "@/lib/db";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Badge im Sidebar-Reiter "Anrufe" — Anzahl offener Call-Reminders aus
  // Kadenz-Schritten. Sehr leichter Query mit Index auf status.
  const pendingCalls = await prisma.reminder.count({
    where: { status: "pending", step: { channel: "call" } },
  });

  return (
    <div className="flex h-full">
      <Sidebar pendingCalls={pendingCalls} />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
