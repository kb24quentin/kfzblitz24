import { auth } from "@/lib/auth";

/**
 * Schützt nur den /admin-Bereich. Das Customer-Portal auf `/` und die
 * öffentlichen /api/lookup, /api/pdf, /api/invoice-pdf, /api/retoure
 * (Bearer-Auth-gesichert) bleiben für nicht-eingeloggte Aufrufer offen.
 */
export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isLoggedIn = !!req.auth;
  const isLoginPage = path === "/login";
  const isAdminArea = path.startsWith("/admin");
  const isAdminApi = path.startsWith("/api/admin");

  if (isLoginPage && isLoggedIn) {
    return Response.redirect(new URL("/admin", req.nextUrl));
  }

  if ((isAdminArea || isAdminApi) && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("from", path);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)",
  ],
};
