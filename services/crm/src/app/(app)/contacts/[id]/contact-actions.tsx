"use client";

import { changeStatus, changePriority, assignContact } from "./actions";

const statusOptions = [
  { value: "new", label: "Neu" },
  { value: "contacted", label: "Kontaktiert" },
  { value: "replied", label: "Geantwortet" },
  { value: "interested", label: "Interessiert" },
  { value: "not_interested", label: "Kein Interesse" },
  { value: "customer", label: "Kunde" },
];

const priorityOptions = [
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
];

type User = { id: string; name: string };

export function StatusSelect({ contactId, currentStatus }: { contactId: string; currentStatus: string }) {
  return (
    <select
      defaultValue={currentStatus}
      onChange={(e) => changeStatus(contactId, e.target.value)}
      className="px-3 py-1.5 border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50"
    >
      {statusOptions.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}

export function PrioritySelect({ contactId, currentPriority }: { contactId: string; currentPriority: string }) {
  return (
    <select
      defaultValue={currentPriority}
      onChange={(e) => changePriority(contactId, e.target.value)}
      className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
    >
      {priorityOptions.map((p) => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </select>
  );
}

export function AssignSelect({ contactId, currentAssignedId, users }: { contactId: string; currentAssignedId: string | null; users: User[] }) {
  return (
    <select
      defaultValue={currentAssignedId || ""}
      onChange={(e) => assignContact(contactId, e.target.value || null)}
      className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
    >
      <option value="">— Nicht zugewiesen —</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>{u.name}</option>
      ))}
    </select>
  );
}

export function ReminderDoneButton({ reminderId, contactId }: { reminderId: string; contactId: string }) {
  const { completeReminder } = require("./actions");
  return (
    <button
      onClick={() => completeReminder(reminderId, contactId)}
      className="text-xs px-2 py-1 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors font-medium"
    >
      Erledigt
    </button>
  );
}
