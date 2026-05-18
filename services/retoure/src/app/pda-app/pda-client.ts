"use client";

/**
 * Mini-Helper für die PDA-Web-Demo.
 *
 * Speichert Bearer-Token + PDA-ID in localStorage und reicht beides
 * an jeden Request weiter. Sehr einfach gehalten — keine externe Lib.
 */

const TOKEN_KEY = "kb24-pda-token";
const PDA_ID_KEY = "kb24-pda-id";

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setToken(v: string) {
  if (typeof window === "undefined") return;
  if (v.trim()) localStorage.setItem(TOKEN_KEY, v.trim());
  else localStorage.removeItem(TOKEN_KEY);
}

export function getPdaId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PDA_ID_KEY) ?? "";
}

export function setPdaId(v: string) {
  if (typeof window === "undefined") return;
  if (v.trim()) localStorage.setItem(PDA_ID_KEY, v.trim());
  else localStorage.removeItem(PDA_ID_KEY);
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error("Kein API-Token gesetzt — siehe Einstellungen.");
  }
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && "error" in json && (json as { error?: string }).error) ||
      `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return json as T;
}
