"use client";

import Link from "next/link";
import { MoreHorizontal, Mail, Trash2, Edit } from "lucide-react";
import { useState } from "react";
import { deleteContact } from "./actions";

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  position: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  tags: string;
  createdAt: Date;
};

const statusLabels: Record<string, { label: string; color: string }> = {
  new: { label: "Neu", color: "bg-blue-100 text-blue-700" },
  contacted: { label: "Kontaktiert", color: "bg-yellow-100 text-yellow-700" },
  replied: { label: "Geantwortet", color: "bg-green-100 text-green-700" },
  interested: { label: "Interessiert", color: "bg-emerald-100 text-emerald-700" },
  not_interested: { label: "Kein Interesse", color: "bg-red-100 text-red-700" },
  customer: { label: "Kunde", color: "bg-purple-100 text-purple-700" },
};

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  if (contacts.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
        <Mail className="w-12 h-12 text-text-light/40 mx-auto mb-3" />
        <p className="text-text-light font-medium">Keine Kontakte gefunden</p>
        <p className="text-sm text-text-light mt-1">
          Importiere eine Liste oder füge Kontakte manuell hinzu
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-secondary">
            <th className="w-10 p-3">
              <input
                type="checkbox"
                checked={selectedIds.size === contacts.length}
                onChange={toggleAll}
                className="rounded border-border"
              />
            </th>
            <th className="text-left p-3 font-medium text-text-light">Name</th>
            <th className="text-left p-3 font-medium text-text-light">Email</th>
            <th className="text-left p-3 font-medium text-text-light">Firma</th>
            <th className="text-left p-3 font-medium text-text-light">Status</th>
            <th className="text-left p-3 font-medium text-text-light">Stadt</th>
            <th className="w-10 p-3"></th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => {
            const status = statusLabels[contact.status] || statusLabels.new;
            return (
              <tr
                key={contact.id}
                className="border-b border-border last:border-0 hover:bg-bg-secondary/50 transition-colors"
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={() => toggleSelect(contact.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="p-3">
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="font-medium text-text hover:text-accent transition-colors"
                  >
                    {contact.firstName} {contact.lastName}
                  </Link>
                  {contact.position && (
                    <p className="text-xs text-text-light">{contact.position}</p>
                  )}
                </td>
                <td className="p-3 text-text-light">{contact.email}</td>
                <td className="p-3 text-text-light">{contact.company || "–"}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="p-3 text-text-light">{contact.city || "–"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/contacts/${contact.id}/edit`}
                      className="p-1.5 hover:bg-bg-secondary rounded-lg transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5 text-text-light" />
                    </Link>
                    <form action={deleteContact}>
                      <input type="hidden" name="id" value={contact.id} />
                      <button
                        type="submit"
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={(e) => {
                          if (!confirm("Kontakt wirklich löschen?"))
                            e.preventDefault();
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-danger" />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
