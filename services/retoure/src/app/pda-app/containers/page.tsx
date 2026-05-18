"use client";

import { useEffect, useState } from "react";
import { api } from "../pda-client";

interface ContainerSummary {
  id: string;
  code: string;
  type: string;
  status: string;
  openedAt: string;
  maxOpenUntil: string | null;
  closedAt: string | null;
  items: { id: string }[];
}

// Falls die List-API noch nicht da ist, fallen wir auf eine einfache
// "letzte 10 Container im Admin"-Liste zurück via direktem Datenbankzugriff.
// Hier nehmen wir die zugängliche /api/pda/containers GET-Route an.
// Solange die nicht existiert, zeigen wir nur "Neuer Container" Button + Hinweis.

export default function PdaContainersListPage() {
  const [containers, setContainers] = useState<ContainerSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ containers: ContainerSummary[] }>(
          "/api/pda/containers"
        ).catch((e) => {
          // GET-Endpoint existiert ggf. noch nicht — dann leere Liste
          if (String(e).match(/HTTP 4\d\d/)) return { containers: [] as ContainerSummary[] };
          throw e;
        });
        setContainers(data.containers ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4 mt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Container</h1>
        <a
          href="/pda-app/containers/new"
          className="bg-[#ff6600] text-white text-sm font-semibold px-4 py-2 rounded-lg active:bg-[#ff7a26]"
        >
          + Neu
        </a>
      </div>

      {loading && <p className="text-white/60 text-sm">Lade…</p>}

      {error && !error.match(/HTTP 4\d\d/) && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {containers && containers.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/60 text-center">
          Noch keine Container.
          <br />
          Tippe „+ Neu" um eine Palette anzulegen.
        </div>
      )}

      {containers && containers.length > 0 && (
        <ul className="space-y-2">
          {containers.map((c) => (
            <li key={c.id}>
              <a
                href={`/pda-app/containers/${c.id}`}
                className="block bg-white/5 border border-white/10 rounded-xl p-3 active:bg-white/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold">{c.code}</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      {c.type} · {c.items.length} Artikel
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      c.status === "open"
                        ? "bg-green-500/20 text-green-100"
                        : c.status === "closed"
                        ? "bg-yellow-500/20 text-yellow-100"
                        : "bg-white/10 text-white/70"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      <a
        href="/pda-app"
        className="block text-center text-xs text-white/60 underline pt-4"
      >
        Zurück
      </a>
    </div>
  );
}
