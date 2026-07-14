import { Settings, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { APPS } from "@/lib/apps";
import { TeamMatrix } from "./team-matrix";
import { PendingAccessRequests } from "./access-requests";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  const currentUser = session?.user?.email
    ? await prisma.user.findUnique({ where: { email: session.user.email } })
    : null;

  const [users, pendingRequests] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "asc" }, { name: "asc" }],
      include: { appAccesses: true },
    }),
    prisma.accessRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, imageUrl: true } },
      },
    }),
  ]);

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    imageUrl: u.imageUrl,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
    accesses: u.appAccesses.map((a) => ({ appKey: a.appKey, role: a.role })),
  }));

  const pendingCount = users.filter((u) => !u.active).length;
  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="max-w-full">
      <h1 className="text-xl font-bold text-text flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5" /> Einstellungen
      </h1>

      {isAdmin && (
        <PendingAccessRequests requests={pendingRequests} apps={APPS} />
      )}

      <div className="bg-bg-card border border-border rounded-xl p-6">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-semibold text-text flex items-center gap-2">
            <Users className="w-4 h-4" /> Team & App-Rechte
          </h2>
          {pendingCount > 0 && (
            <span className="text-xs text-warning font-medium">
              {pendingCount} Konto/Konten wartet auf Freigabe
            </span>
          )}
        </div>
        <p className="text-xs text-text-light mb-4">
          Zentrale Rechte-Matrix: welcher Kollege darf welche Anwendung nutzen
          und in welcher Rolle. Neue Google-SSO-Logins landen als pending,
          brauchen zuerst Aktivierung + Rechte-Vergabe. Klick in einer leeren
          Zelle wählt eine Rolle (Zugriff wird sofort gewährt). Klick auf einen
          bestehenden Zugriff (rote Farbe im Hover) entzieht ihn.
        </p>
        {currentUser ? (
          <TeamMatrix
            users={rows}
            currentUserId={currentUser.id}
            isAdmin={isAdmin}
            apps={APPS}
          />
        ) : (
          <p className="text-sm text-text-light">Bitte neu einloggen.</p>
        )}
      </div>
    </div>
  );
}
