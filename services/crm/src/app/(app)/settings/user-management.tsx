"use client";

import { useState } from "react";
import { Plus, Shield, User, Edit, Save, X } from "lucide-react";
import { createUser, updateUser, toggleUserActive } from "./actions";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date;
};

export function UserManagement({ users }: { users: UserData[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Add User Button */}
      <div className="flex justify-end">
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Plus className="w-4 h-4" /> Neuer Benutzer
        </button>
      </div>

      {/* Add User Form */}
      {showForm && (
        <form
          action={async (formData) => {
            await createUser(formData);
            setShowForm(false);
          }}
          className="bg-bg-card rounded-xl border border-border p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text">Neuen Benutzer anlegen</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 hover:bg-bg-secondary rounded-lg">
              <X className="w-4 h-4 text-text-light" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Name *</label>
              <input name="name" required className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" placeholder="Max Mustermann" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Email *</label>
              <input name="email" type="email" required className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" placeholder="max@kfzblitz24.de" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Passwort *</label>
              <input name="password" type="password" required minLength={6} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" placeholder="Mind. 6 Zeichen" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-light mb-1">Rolle</label>
              <select name="role" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50">
                <option value="user">Benutzer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors">
            <Save className="w-4 h-4" /> Benutzer erstellen
          </button>
        </form>
      )}

      {/* User List */}
      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-secondary">
              <th className="text-left p-3 font-medium text-text-light">Benutzer</th>
              <th className="text-left p-3 font-medium text-text-light">Email</th>
              <th className="text-left p-3 font-medium text-text-light">Rolle</th>
              <th className="text-left p-3 font-medium text-text-light">Status</th>
              <th className="text-left p-3 font-medium text-text-light">Erstellt</th>
              <th className="w-20 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-bg-secondary/50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium">{user.name}</span>
                  </div>
                </td>
                <td className="p-3 text-text-light">{user.email}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {user.role === "admin" ? (
                      <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Admin</span>
                    ) : (
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> Benutzer</span>
                    )}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {user.active ? "Aktiv" : "Deaktiviert"}
                  </span>
                </td>
                <td className="p-3 text-text-light text-xs">
                  {new Date(user.createdAt).toLocaleDateString("de-DE")}
                </td>
                <td className="p-3">
                  <form action={toggleUserActive}>
                    <input type="hidden" name="id" value={user.id} />
                    <input type="hidden" name="active" value={user.active ? "false" : "true"} />
                    <button
                      type="submit"
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        user.active
                          ? "text-danger hover:bg-red-50"
                          : "text-success hover:bg-green-50"
                      }`}
                    >
                      {user.active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
