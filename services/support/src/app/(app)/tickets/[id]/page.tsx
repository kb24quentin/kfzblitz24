import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      contact: true,
      assignee: true,
      messages: { orderBy: { createdAt: "asc" } },
      notes: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!ticket) notFound();

  return (
    <div>
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1 text-sm text-text-light hover:text-text mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Zurück zur Ticket-Liste
      </Link>

      <h1 className="text-xl font-bold text-text mb-1">
        #{ticket.number} · {ticket.subject}
      </h1>
      <p className="text-sm text-text-light mb-6">
        Von {ticket.contact.name || ticket.contact.email} · Status {ticket.status}
      </p>

      <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-light">
        Detail-View wird in einer folgenden Iteration ausgebaut (Thread, Notizen,
        AI-Draft, Antwort-Composer).
      </div>
    </div>
  );
}
