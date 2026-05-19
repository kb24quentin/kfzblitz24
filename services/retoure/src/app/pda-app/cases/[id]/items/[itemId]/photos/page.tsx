"use client";

/**
 * PDA Item-Photos.
 *
 * Pro Item lädt der Mitarbeiter typischerweise 1–4 Fotos hoch:
 *   - OVP (Originalverpackung)
 *   - Artikel
 *   - Detail 1 / Detail 2 (z. B. Schadstelle)
 *
 * Upload geht via Multipart an `/api/pda/cases/:id/items/:itemId/photos`,
 * der Server schreibt das Bild auf Disk und triggert per `after()` das
 * OpenAI-Vision-Scoring. Wir zeigen hier nur die Server-Antwort an —
 * der AI-Score landet asynchron in der DB und wird beim nächsten Reload
 * in `ai`-Feld der Liste sichtbar.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { api, getPdaId, getToken } from "../../../../../pda-client";

type Kind = "ovp" | "artikel" | "detail1" | "detail2" | "other";

interface PhotoListItem {
  id: string;
  kind: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  ai: {
    score?: number;
    reasoning?: string;
    confidence?: number;
  } | null;
}

const KIND_LABEL: Record<Kind, string> = {
  ovp: "OVP",
  artikel: "Artikel",
  detail1: "Detail 1",
  detail2: "Detail 2",
  other: "Sonstiges",
};

const KIND_ORDER: Kind[] = ["ovp", "artikel", "detail1", "detail2"];

export default function PdaItemPhotosPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = use(params);
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<Kind, HTMLInputElement | null>>({
    ovp: null,
    artikel: null,
    detail1: null,
    detail2: null,
    other: null,
  });

  const load = useCallback(async () => {
    try {
      const r = await api<{ photos: PhotoListItem[] }>(
        `/api/pda/cases/${id}/items/${itemId}/photos`,
      );
      setPhotos(r.photos);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id, itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (kind: Kind, file: File) => {
    setUploading(kind);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const pdaId = getPdaId();
      if (pdaId) fd.append("pdaId", pdaId);
      // Multipart braucht eigenen fetch — die `api()`-Wrapper-Funktion
      // setzt JSON-Content-Type, das passt hier nicht.
      const token = getToken();
      const res = await fetch(
        `/api/pda/cases/${id}/items/${itemId}/photos`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        },
      );
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
    }
  };

  const onPick = (kind: Kind) => {
    fileInputs.current[kind]?.click();
  };

  const onFileChange = (kind: Kind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // reset für Mehrfach-Upload des gleichen Kinds
    if (f) void upload(kind, f);
  };

  const onDelete = async (photoId: string) => {
    if (!confirm("Foto löschen?")) return;
    try {
      const token = getToken();
      const res = await fetch(
        `/api/pda/cases/${id}/items/${itemId}/photos/${photoId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const byKind: Record<Kind, PhotoListItem[]> = {
    ovp: [],
    artikel: [],
    detail1: [],
    detail2: [],
    other: [],
  };
  for (const p of photos) {
    const k = (p.kind as Kind) ?? "other";
    (byKind[k] ?? byKind.other).push(p);
  }

  return (
    <div className="space-y-4 mt-2">
      <header>
        <h1 className="text-xl font-bold">Fotos</h1>
        <p className="text-sm text-white/60 mt-1">
          OVP, Artikel, ggf. Detail-Aufnahmen. Werden im Hintergrund per
          AI bewertet — fließt in den Verdict ein.
        </p>
      </header>

      {error && (
        <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {KIND_ORDER.map((k) => {
        const list = byKind[k];
        const has = list.length > 0;
        const isUploading = uploading === k;
        return (
          <section
            key={k}
            className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white">{KIND_LABEL[k]}</p>
              <span className="text-xs text-white/50">
                {list.length} {list.length === 1 ? "Foto" : "Fotos"}
              </span>
            </div>

            {/* Vorhandene Fotos als Thumbnails */}
            {has && (
              <div className="grid grid-cols-3 gap-2">
                {list.map((p) => (
                  <div
                    key={p.id}
                    className="relative bg-black/30 rounded-lg overflow-hidden aspect-square"
                  >
                    <img
                      src={`/api/pda/cases/${id}/items/${itemId}/photos/${p.id}/download`}
                      alt={p.filename}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {p.ai?.score !== undefined && (
                      <span
                        className={`absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          p.ai.score >= 85
                            ? "bg-green-500/90 text-white"
                            : p.ai.score >= 50
                              ? "bg-yellow-500/90 text-white"
                              : "bg-red-500/90 text-white"
                        }`}
                      >
                        AI {p.ai.score}
                      </span>
                    )}
                    <button
                      onClick={() => onDelete(p.id)}
                      className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Capture-Button + Hidden Input */}
            <input
              ref={(el) => {
                fileInputs.current[k] = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange(k)}
              className="hidden"
            />
            <button
              onClick={() => onPick(k)}
              disabled={isUploading || loading}
              className="w-full bg-[#ff6600] text-white font-semibold py-3 rounded-lg active:bg-[#ff7a26] disabled:opacity-40 text-sm"
            >
              {isUploading
                ? "Lade hoch…"
                : has
                  ? `+ Weiteres ${KIND_LABEL[k]}-Foto`
                  : `📷 ${KIND_LABEL[k]} aufnehmen`}
            </button>
          </section>
        );
      })}

      <button
        onClick={() => router.push(`/pda-app/cases/${id}`)}
        className="w-full bg-white/10 text-white font-semibold py-3 rounded-xl active:bg-white/20"
      >
        Zurück zur Bewertung
      </button>
    </div>
  );
}
