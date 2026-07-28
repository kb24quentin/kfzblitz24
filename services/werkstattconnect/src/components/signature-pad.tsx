"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * Standalone signature-pad. Produziert eine SVG-dataUri über den callback.
 * Nutzbar sowohl im werkstatt-tablet als auch auf der public /sign-page.
 */
export function SignaturePad({
  onChange,
  height = 140,
  strokeColor = "#0f172a",
}: {
  onChange: (svgDataUri: string | null) => void;
  height?: number;
  strokeColor?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const pathsRef = useRef<{ x: number; y: number }[][]>([]);
  const currentPath = useRef<{ x: number; y: number }[]>([]);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [strokeColor]);

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
      onChange(toSvgDataUri());
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
    onChange(null);
  }

  function toSvgDataUri(): string {
    const w = canvasRef.current?.clientWidth ?? 400;
    const h = canvasRef.current?.clientHeight ?? height;
    const d = pathsRef.current
      .map((path) => {
        if (path.length < 2) return "";
        return "M" + path.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
      })
      .filter(Boolean)
      .join(" ");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${d}" stroke="${strokeColor}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  return (
    <div>
      <div className="bg-white rounded-lg overflow-hidden border border-slate-300 touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="w-full block cursor-crosshair"
          style={{ height: `${height}px` }}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={!hasSignature}
        className="mt-1 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
      >
        <X className="w-3 h-3" /> Unterschrift löschen
      </button>
    </div>
  );
}
