import Link from "next/link";
import {
  LayoutGrid,
  Inbox,
  PackageOpen,
  Users,
  ShieldCheck,
  FileSignature,
  Store,
  Lock,
  Newspaper,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { APPS } from "@/lib/apps";
import { RequestAccessButton } from "./request-access-button";

export const dynamic = "force-dynamic";

// Icon lookup — icons are strings in the apps registry so we can serialize them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICONS: Record<string, any> = {
  Inbox,
  PackageOpen,
  Users,
  ShieldCheck,
  FileSignature,
  Store,
};

export default async function IntranetLanding() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const me = await prisma.user.findUnique({
    where: { email },
    include: { appAccesses: true, accessRequests: { where: { status: "pending" } } },
  });
  const isAdmin = me?.role === "admin";
  const grantedAppKeys = new Set(me?.appAccesses.map((a) => a.appKey) || []);
  const pendingByApp = new Map(
    (me?.accessRequests || []).map((r) => [r.appKey, r.requestedRole])
  );

  const [newsLatest, teamCount] = await Promise.all([
    prisma.newsPost.findMany({
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 3,
      include: { author: { select: { name: true, imageUrl: true } } },
    }),
    prisma.user.count({ where: { active: true } }),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text flex items-center gap-3">
          <LayoutGrid className="w-6 h-6 text-accent" />
          Willkommen zurück, {(me?.name || email.split("@")[0]).split(" ")[0]}
        </h1>
        <p className="text-sm text-text-light mt-1">
          {isAdmin
            ? "Du hast Admin-Rechte im Intranet."
            : `${grantedAppKeys.size} von ${APPS.length} internen Anwendungen freigeschaltet.`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {APPS.map((app) => {
          const IconComp = ICONS[app.icon] || LayoutGrid;
          const hasAccess = isAdmin || grantedAppKeys.has(app.key);
          return hasAccess ? (
            <a
              key={app.key}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-bg-card border border-border rounded-2xl p-5 hover:border-accent/40 hover:shadow-md transition-all"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white mb-3"
                style={{ background: app.color }}
              >
                <IconComp className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-text mb-1 flex items-center gap-1">
                {app.label}
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-text-light">{app.description}</p>
            </a>
          ) : (
            <div
              key={app.key}
              className="bg-bg-card border border-border rounded-2xl p-5 relative"
            >
              <div className="absolute top-3 right-3 text-text-light">
                <Lock className="w-4 h-4" />
              </div>
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white mb-3 grayscale opacity-70"
                style={{ background: app.color }}
              >
                <IconComp className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-text mb-1">{app.label}</h3>
              <p className="text-xs text-text-light">{app.description}</p>
              <RequestAccessButton
                app={app}
                pendingRole={pendingByApp.get(app.key) || null}
              />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-text flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-accent" /> Neuigkeiten
            </h2>
            <Link
              href="/news"
              className="text-xs text-accent hover:underline"
            >
              Alle →
            </Link>
          </div>
          {newsLatest.length === 0 ? (
            <div className="text-sm text-text-light py-6 text-center italic">
              Noch keine News. Admin kann welche unter{" "}
              <Link href="/news" className="underline">
                News
              </Link>{" "}
              anlegen.
            </div>
          ) : (
            <ul className="space-y-3">
              {newsLatest.map((n) => (
                <li key={n.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                  <div className="flex items-baseline gap-2 text-xs text-text-light mb-0.5">
                    {n.pinned && (
                      <span className="text-accent font-medium">⭐ Angeheftet</span>
                    )}
                    <span>{n.author.name}</span>
                    <span>·</span>
                    <span>{n.publishedAt.toLocaleDateString("de-DE")}</span>
                  </div>
                  <div className="font-medium text-text">{n.title}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-text flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-accent" /> Wissensdatenbank
            </h2>
            <p className="text-xs text-text-light mb-3">
              FAQ, Anleitungen, Prozessbeschreibungen — im Aufbau.
            </p>
            <Link
              href="/wiki"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              Öffnen <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-text flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-accent" /> Team
            </h2>
            <p className="text-xs text-text-light mb-3">
              {teamCount} aktive Kollegen im Intranet.
            </p>
            <Link
              href="/team"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              Who-is-Who <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
