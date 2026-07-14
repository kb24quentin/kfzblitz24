import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isPendingPage = req.nextUrl.pathname === "/pending";
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isWebhook = req.nextUrl.pathname.startsWith("/api/webhook");
  const isCron = req.nextUrl.pathname.startsWith("/api/cron");
  const isHealth = req.nextUrl.pathname === "/api/health";

  if (isApiAuth || isWebhook || isCron || isHealth) return;

  if (isLoginPage && isLoggedIn) {
    return Response.redirect(new URL("/", req.nextUrl));
  }

  if (!isLoggedIn && !isLoginPage && !isPendingPage) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)",
  ],
};
