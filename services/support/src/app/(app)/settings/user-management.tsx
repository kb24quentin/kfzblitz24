"use client";

import { useState } from "react";
import { Plus, Shield, User, Edit2, Save, X } from "lucide-react";
import {
  createUserAction,
  updateUserAction,
  toggleUserActiveAction,
} from "./actions";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date;
};

export function UserManagement({
  users,
  currentUserId,
  isAdmin,
}: {
  users: UserData[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <p className="text-sm text-text-light">
        Nur Admins dürfen Team-Mitglieder verwalten.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-text-light">
          {users.length} Team-Mitglied(er). Als Admin kannst du Zugänge anlegen,
          bearbeiten und aktivieren/deaktivieren.
        </p>
        {!showForm && !editingId && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Plus className="w-4 h-4" /> Neues Team-Mitglied
          </button>
        )}
      </div>

      {showForm && (
        <form
          action={async (formData) => {
            await createUserAction(formData);
            setShowForm(false);
          }}
          className="bg-bg-secondary/50 rounded-xl border border-accent/30 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text">Neues Team-Mitglied anlegen</h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 hover:bg-bg-card rounded-lg"
            >
              <X className="w-4 h-4 text-text-light" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Name *</label>
              <input
                name="name"
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Email *</label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="max@kfzblitz24.de"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Passwort *</label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="Mind. 6 Zeichen"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Rolle</label>
              <select
                name="role"
                defaultValue="agent"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="agent">Agent (Tickets bearbeiten)</option>
                <option value="admin">Admin (alles inkl. Team-Verwaltung)</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Save className="w-4 h-4" /> Anlegen
          </button>
        </form>
      )}

      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-secondary">
              <th className="text-left p-3 font-medium text-text-light">Mitglied</th>
              <th className="text-left p-3 font-medium text-text-light">Email</th>
              <th className="text-left p-3 font-medium text-text-light">Rolle</th>
              <th className="text-left p-3 font-medium text-text-light">Status</th>
              <th className="text-left p-3 font-medium text-text-light">Angelegt</th>
              <th className="w-32 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isEditing = editingId === user.id;
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id} className="border-b border-border last:border-0">
                  {isEditing ? (
                    <td colSpan={6} className="p-3 bg-bg-secondary/40">
                      <form
                        action={async (formData) => {
                          await updateUserAction(formData);
                          setEditingId(null);
                        }}
                        className="space-y-3"
                      >
                        <input type="hidden" name="id" value={user.id} />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-text-light mb-1">Name</label>
                            <input
                              name="name"
                              required
                              defaultValue={user.name}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-light mb-1">Email</label>
                            <input
                              name="email"
                              type="email"
                              required
                              defaultValue={user.email}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-text-light mb-1">Rolle</label>
                            <select
                              name="role"
                              defaultValue={user.role}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white disabled:bg-bg-secondary"
                              disabled={isSelf}
                            >
                              <option value="agent">Agent</option>
                              <option value="admin">Admin</option>
                            </select>
                            {isSelf && (
                              <p className="text-xs text-text-light mt-1">
                                Eigene Rolle kann nicht geändert werden.
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-light mb-1">
                              Neues Passwort (optional)
                            </label>
                            <input
                              name="password"
                              type="password"
                              minLength={6}
                              placeholder="leer = unverändert"
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light"
                          >
                            <Save className="w-3.5 h-3.5" /> Speichern
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 border border-border rounded-lg text-sm text-text-light hover:bg-bg-secondary"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="font-medium">
                            {user.name}
                            {isSelf && (
                              <span className="ml-1 text-xs text-text-light">(du)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-text-light">{user.email}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-accent/15 text-accent"
                              : "bg-info/10 text-info"
                          }`}
                        >
                          {user.role === "admin" ? (
                            <>
                              <Shield className="w-3 h-3" /> Admin
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3" /> Agent
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.active
                              ? "bg-success/15 text-success"
                              : "bg-danger/15 text-danger"
                          }`}
                        >
                          {user.active ? "Aktiv" : "Deaktiviert"}
                        </span>
                      </td>
                      <td className="p-3 text-text-light text-xs">
                        {new Date(user.createdAt).toLocaleDateString("de-DE")}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => {
                              setEditingId(user.id);
                              setShowForm(false);
                            }}
                            className="p-1.5 text-text-light hover:text-text hover:bg-bg-secondary rounded"
                            title="Bearbeiten / Passwort ändern"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <form action={toggleUserActiveAction}>
                            <input type="hidden" name="id" value={user.id} />
                            <input
                              type="hidden"
                              name="active"
                              value={user.active ? "false" : "true"}
                            />
                            <button
                              type="submit"
                              disabled={isSelf && user.active}
                              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                user.active
                                  ? "text-danger hover:bg-danger/10"
                                  : "text-success hover:bg-success/10"
                              }`}
                              title={isSelf && user.active ? "Selbst-Deaktivierung nicht möglich" : ""}
                            >
                              {user.active ? "Deaktivieren" : "Aktivieren"}
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
    </div>
  );
}
