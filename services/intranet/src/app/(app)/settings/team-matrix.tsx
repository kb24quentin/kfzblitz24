"use client";

import { useState } from "react";
import { Shield, User, Check, Ban, Edit2, Save, X } from "lucide-react";
import type { AppDef } from "@/lib/apps";
import {
  toggleUserActiveAction,
  updateUserAction,
  grantAccessAction,
  revokeAccessAction,
} from "./actions";

type AccessRow = { appKey: string; role: string };
type Row = {
  id: string;
  email: string;
  name: string;
  imageUrl: string | null;
  role: string;
  active: boolean;
  createdAt: Date;
  accesses: AccessRow[];
};

export function TeamMatrix({
  users,
  currentUserId,
  isAdmin,
  apps,
}: {
  users: Row[];
  currentUserId: string;
  isAdmin: boolean;
  apps: readonly AppDef[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <p className="text-sm text-text-light">
        Nur Admins dürfen Team + Rechte verwalten.
      </p>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase text-text-light">
            <th className="p-3 font-medium">Mitglied</th>
            <th className="p-3 font-medium">Intranet-Rolle</th>
            <th className="p-3 font-medium">Status</th>
            {apps.map((a) => (
              <th key={a.key} className="p-2 font-medium text-center">
                {a.label}
              </th>
            ))}
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isEditing = editingId === u.id;
            const isSelf = u.id === currentUserId;
            const accessMap = new Map(u.accesses.map((a) => [a.appKey, a.role]));

            return (
              <tr key={u.id} className="border-b border-border last:border-0">
                {isEditing ? (
                  <td colSpan={4 + apps.length} className="p-3 bg-bg-secondary/40">
                    <form
                      action={async (fd) => {
                        await updateUserAction(fd);
                        setEditingId(null);
                      }}
                      className="flex items-end gap-3"
                    >
                      <input type="hidden" name="id" value={u.id} />
                      <div>
                        <label className="block text-xs text-text-light mb-1">Name</label>
                        <input
                          name="name"
                          defaultValue={u.name}
                          required
                          className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-light mb-1">Intranet-Rolle</label>
                        <select
                          name="role"
                          defaultValue={u.role}
                          disabled={isSelf}
                          className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="flex items-center gap-1 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium"
                      >
                        <Save className="w-3.5 h-3.5" /> Speichern
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm text-text-light"
                      >
                        <X className="w-3.5 h-3.5" /> Abbrechen
                      </button>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {u.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.imageUrl} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {u.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-text">
                            {u.name} {isSelf && <span className="text-xs text-text-light">(du)</span>}
                          </div>
                          <div className="text-xs text-text-light">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-accent/15 text-accent"
                            : "bg-info/10 text-info"
                        }`}
                      >
                        {u.role === "admin" ? (
                          <><Shield className="w-3 h-3" /> Admin</>
                        ) : (
                          <><User className="w-3 h-3" /> User</>
                        )}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.active
                            ? "bg-success/15 text-success"
                            : "bg-danger/15 text-danger"
                        }`}
                      >
                        {u.active ? "Aktiv" : "Pending"}
                      </span>
                    </td>
                    {apps.map((app) => {
                      const current = accessMap.get(app.key);
                      const currentRoleDef = current
                        ? app.roles.find((r) => r.key === current)
                        : null;
                      return (
                        <td key={app.key} className="p-2 text-center whitespace-nowrap">
                          {current ? (
                            <form action={revokeAccessAction} className="inline-flex">
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="appKey" value={app.key} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-success/15 text-success hover:bg-danger/15 hover:text-danger transition-colors group"
                                title={
                                  currentRoleDef
                                    ? `${currentRoleDef.label}: ${currentRoleDef.description}\n\n(Klick zum Entziehen)`
                                    : `Zugriff als '${current}' entziehen`
                                }
                              >
                                <Check className="w-3 h-3 group-hover:hidden" />
                                <X className="w-3 h-3 hidden group-hover:block" />
                                {currentRoleDef?.label || current}
                              </button>
                            </form>
                          ) : (
                            <form action={grantAccessAction} className="inline-flex">
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="appKey" value={app.key} />
                              <select
                                name="role"
                                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                                defaultValue=""
                                className="px-2 py-0.5 text-xs border border-border rounded bg-white text-text-light"
                                title={app.roles
                                  .map((r) => `${r.label}: ${r.description}`)
                                  .join("\n\n")}
                              >
                                <option value="" disabled>
                                  + Rolle
                                </option>
                                {app.roles.map((r) => (
                                  <option key={r.key} value={r.key} title={r.description}>
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            </form>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(u.id)}
                          className="p-2 text-text-light hover:text-text hover:bg-bg-secondary rounded"
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <form action={toggleUserActiveAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                          <button
                            type="submit"
                            disabled={isSelf && u.active}
                            className={`p-2 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                              u.active
                                ? "text-text-light hover:text-danger hover:bg-danger/10"
                                : "text-text-light hover:text-success hover:bg-success/10"
                            }`}
                            title={u.active ? "Deaktivieren" : "Aktivieren"}
                          >
                            {u.active ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </button>
                        </form>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
