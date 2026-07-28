"use client";

import { useRef, useState, useEffect } from "react";
import { Signature, Check, X } from "lucide-react";
import { customerApproveAction } from "../actions";

export function CustomerSignaturePad({
  appointmentId,
  defaultAmount,
}: {
  appointmentId: string;
  defaultAmount: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [amount, setAmount] = useState(defaultAmount);
  const [hasSignature, setHasSignature] = useState(false);
  const drawing = useRef(false);
  const pathsRef = useRef<{ x: number; y: number }[][]>([]);
  const currentPath = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Retina scaling
    const rect = c.getBoundingClientRect();
    c.width = rect.width * 2;
    c.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    currentPath.current = [pos(e)];
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const p = pos(e);
    const path = currentPath.current;
    const last = path[path.length - 1];
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    path.push(p);
  }

  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (currentPath.current.length > 1) {
      pathsRef.current.push(currentPath.current);
      setHasSignature(true);
    }
    currentPath.current = [];
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, c.width, c.height);
    pathsRef.current = [];
    setHasSignature(false);
  }

  function pathsToSvgDataUrl(): string {
    const w = canvasRef.current?.clientWidth ?? 400;
    const h = canvasRef.current?.clientHeight ?? 120;
    const d = pathsRef.current
      .map((path) => {
        if (path.length < 2) return "";
        return "M" + path.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
      })
      .filter(Boolean)
      .join(" ");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${d}" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  return (
    <form
      action={async (fd) => {
        if (!hasSignature) return;
        fd.set("signatureSvg", pathsToSvgDataUrl());
        await customerApproveAction(fd);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={appointmentId} />
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-amber-300/80 mb-1">
          Freigegebener Betrag (EUR)
        </label>
        <input
          type="text"
          name="approvedAmount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-3 bg-white/95 text-slate-900 rounded-lg text-2xl font-bold text-right tabular-nums"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-amber-300/80 mb-1">
          Unterschrift Kunde
        </label>
        <div className="bg-white rounded-lg overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="w-full h-32 cursor-crosshair"
          />
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-amber-300/70 hover:text-amber-200 mt-1"
        >
          <X className="w-3 h-3 inline" /> Löschen
        </button>
      </div>
      <button
        type="submit"
        disabled={!hasSignature}
        className="w-full inline-flex items-center justify-center gap-2 py-4 bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg"
      >
        <Check className="w-5 h-5" />
        Freigabe bestätigen
      </button>
    </form>
  );
}
