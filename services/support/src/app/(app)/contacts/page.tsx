import Link from "next/link";
import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { fullNameOf } from "@/lib/name-parse";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await prisma.contact.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { _count: { select: { tickets: true } } },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <Users className="w-5 h-5" /> Kontakte
        </h1>
        <p className="text-sm text-text-light mt-1">
          Automatisch erzeugt sobald eine Mail von einer neuen Adresse eintrifft.
        </p>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-sm text-text-light">
          Noch keine Kontakte.
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary border-b border-border">
              <tr className="text-left text-xs uppercase text-text-light">
                <th className="px-4 py-3 font-medium">Name / Email</th>
                <th className="px-4 py-3 font-medium">Bestellung</th>
                <th className="px-4 py-3 font-medium">Tickets</th>
                <th className="px-4 py-3 font-medium">Zuletzt aktiv</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-bg-secondary/50">
                  <td className="px-4 py-3">
                    <div className="text-text font-medium">
                      {fullNameOf(c) || "—"}
                    </div>
                    <div className="text-xs text-text-light">{c.email}</div>
                    {c.phone && (
                      <div className="text-xs text-text-light">☎ {c.phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-light font-mono text-xs">
                    {c.orderRef || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/tickets?contact=${c.id}`}
                      className="text-accent hover:underline"
                    >
                      {c._count.tickets}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-light">
                    {formatDistanceToNow(c.updatedAt, { locale: de, addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
