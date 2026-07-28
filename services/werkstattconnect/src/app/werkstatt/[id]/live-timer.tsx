"use client";

import { useEffect, useState } from "react";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";

export function LiveTimer({
  startedAt,
  plannedStart,
  plannedEnd,
}: {
  startedAt: string;
  plannedStart: string;
  plannedEnd: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = new Date(startedAt).getTime();
  const plannedMs = new Date(plannedEnd).getTime() - new Date(plannedStart).getTime();
  const elapsedMs = now - start;
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);
  const plannedMin = Math.floor(plannedMs / 60000);
  const overrun = elapsedMin > plannedMin;
  const remainMin = plannedMin - elapsedMin;

  const progressPct = Math.min(100, (elapsedMs / plannedMs) * 100);

  return (
    <div className="mb-6 p-5 bg-gradient-to-br from-orange-900/40 to-slate-900 border border-orange-500/30 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-orange-400">
          <Clock className="w-4 h-4 animate-pulse" />
          <span className="text-xs uppercase tracking-wider font-bold">Läuft</span>
        </div>
        <div className={`text-sm font-semibold flex items-center gap-1 ${overrun ? "text-red-400" : "text-emerald-400"}`}>
          {overrun ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {overrun ? `+${elapsedMin - plannedMin} min über plan` : `${remainMin} min in plan`}
        </div>
      </div>
      <div className="flex items-baseline gap-4 mb-3">
        <div className="text-5xl font-bold text-white tabular-nums">
          {String(Math.floor(elapsedMin / 60)).padStart(2, "0")}:{String(elapsedMin % 60).padStart(2, "0")}
        </div>
        <div className="text-lg text-slate-400 tabular-nums">
          :{String(elapsedSec).padStart(2, "0")}
        </div>
        <div className="text-sm text-slate-500 ml-auto">
          Geplant: {Math.floor(plannedMin / 60)}:{String(plannedMin % 60).padStart(2, "0")} Std
        </div>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${
            overrun ? "bg-gradient-to-r from-orange-500 to-red-500" : "bg-gradient-to-r from-emerald-500 to-orange-500"
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
