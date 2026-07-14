"use client";

import { Check, X, Clock } from "lucide-react";
import { approveRequestAction, denyRequestAction } from "./actions";
import type { AppDef } from "@/lib/apps";

type Req = {
  id: string;
  requestedRole: string;
  message: string | null;
  createdAt: Date;
  appKey: string;
  user: { id: string; name: string; email: string; imageUrl: string | null };
};

export function PendingAccessRequests({
  requests,
  apps,
}: {
  requests: Req[];
  apps: readonly AppDef[];
}) {
  if (requests.length === 0) return null;
  return (
    <div className="mb-6 bg-warning/5 border border-warning/30 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-warning" />
        <h2 className="font-semibold text-text">
          {requests.length} offene Zugriffs-Anfrage{requests.length > 1 ? "n" : ""}
        </h2>
      </div>
      <div className="space-y-2">
        {requests.map((r) => {
          const app = apps.find((a) => a.key === r.appKey);
          const roleLabel =
            app?.roles.find((x) => x.key === r.requestedRole)?.label ||
            r.requestedRole;
          return (
            <div
              key={r.id}
              className="bg-white border border-border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {r.user.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.user.imageUrl} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {r.user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm">
                    <strong>{r.user.name}</strong>{" "}
                    <span className="text-text-light text-xs">({r.user.email})</span>
                  </div>
                  <div className="text-xs text-text-light">
                    beantragt <strong>{app?.label || r.appKey}</strong> als{" "}
                    <strong>{roleLabel}</strong> ·{" "}
                    {new Date(r.createdAt).toLocaleString("de-DE")}
                  </div>
                  {r.message && (
                    <div className="text-xs text-text mt-1 italic bg-bg-secondary rounded px-2 py-1">
                      „{r.message}"
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <form action={approveRequestAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1.5 bg-success text-white rounded-lg text-xs font-medium hover:opacity-90"
                  >
                    <Check className="w-3.5 h-3.5" /> Genehmigen
                  </button>
                </form>
                <form action={denyRequestAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs text-text-light hover:bg-danger/10 hover:text-danger"
                  >
                    <X className="w-3.5 h-3.5" /> Ablehnen
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
