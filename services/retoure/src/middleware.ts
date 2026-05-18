import { auth } from "@/lib/auth";

/**
 * Host-aware Middleware:
 *
 * Wir betreiben in EINEM Container zwei Frontends:
 * • `retoure.*` (Customer-Frontend) — \"Anmelde-Portal\" für Endkunden
 * • `rma.*`     (Admin-Dashboard)   — internes Tool fürs Team
 *
 * Pro Hostname blocken wir die jeweils anderen Routes:
 * - Auf dem Customer-Host sind `/admin*`, `/login`, `/api/admin*` 404
 * - Auf dem Admin-Host wird `/` auf `/admin` redirected; öffentliche
 *   Customer-Endpunkte (lookup/pdf/invoice-pdf) sind nicht erreichbar
 *
 * `/api/auth/*` (NextAuth) und `/api/retoure*` (Bearer) bleiben auf beiden
 * Hosts erreichbar — letzteres weil das Customer-Frontend künftig
 * via API persistieren wird.
 */

type HostKind = "admin" | "customer" | "unknown";

function hostKind(host: string): HostKind {
  const h = host.toLowerCase().split(":")[0];
  if (h.startsWith("rma.")) return "admin";
  if (h.startsWith("retoure.")) return "customer";
  return "unknown"; // local dev / direct IP / anything else
}

const CUSTOMER_API_PREFIXES = ["/api/lookup", "/api/pdf", "/api/invoice-pdf"];

export default auth((req) => {
  const host = req.headers.get("host") ?? "";
  const kind = hostKind(host);
  const path = req.nextUrl.pathname;
  const isLoggedIn = !!req.auth;

  // Unknown host (local dev, direct IP) — keine Restriktion
  if (kind === "unknown") {
    if (path === "/login" && isLoggedIn) {
      return Response.redirect(new URL("/admin", req.nextUrl));
    }
    if ((path.startsWith("/admin") || path.startsWith("/api/admin")) && !isLoggedIn) {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("from", path);
      return Response.redirect(url);
    }
    return;
  }

  // ─── Customer-Host (retoure.*) ───
  if (kind === "customer") {
    // Admin-Routen + Login auf der Customer-Domain sind nicht verfügbar
    if (path.startsWith("/admin") || path === "/login" || path.startsWith("/api/admin")) {
      return new Response("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return;
  }

  // ─── Admin-Host (rma.*) ───
  // Customer-Frontend-Routen weiterleiten/blocken
  if (path === "/") {
    return Response.redirect(new URL("/admin", req.nextUrl));
  }
  if (CUSTOMER_API_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Login & Admin-Auth-Gate
  if (path === "/login" && isLoggedIn) {
    return Response.redirect(new URL("/admin", req.nextUrl));
  }
  if ((path.startsWith("/admin") || path.startsWith("/api/admin")) && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("from", path);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)",
  ],
};
