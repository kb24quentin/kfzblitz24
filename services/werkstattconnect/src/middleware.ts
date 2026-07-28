import { auth } from "@/lib/auth";

/**
 * Route-Guard mit zwei-schichtiger Auth-Logic:
 *  - '/' + '/login' + '/api/health' + '/api/auth/*' → public
 *  - '/admin/*'   → session.audience === 'kb_admin' (Google-SSO KB24)
 *  - '/w/*' / '/app/*' → session.audience === 'workshop' (Werkstatt-user)
 */
export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isLoggedIn = !!req.auth;
  const audience = req.auth?.user
    ? (req.auth.user as { audience?: string }).audience
    : null;

  const isPublic =
    path === "/" ||
    path === "/login" ||
    path === "/admin/login" ||
    path === "/admin/pending" ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/webhook") ||
    path === "/api/health";
  if (isPublic) return;

  const isAdminArea = path === "/admin" || path.startsWith("/admin/");
  const isWorkshopArea = path === "/app" || path.startsWith("/app/");

  if (isAdminArea) {
    if (!isLoggedIn) return Response.redirect(new URL("/admin/login", req.nextUrl));
    if (audience !== "kb_admin") return Response.redirect(new URL("/", req.nextUrl));
    return;
  }
  if (isWorkshopArea) {
    if (!isLoggedIn) return Response.redirect(new URL("/login", req.nextUrl));
    if (audience !== "workshop") return Response.redirect(new URL("/admin", req.nextUrl));
    return;
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)",
  ],
};
