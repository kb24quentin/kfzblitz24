import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isWebhook = req.nextUrl.pathname.startsWith("/api/webhook");
  const isSendApi = req.nextUrl.pathname === "/api/send";

  // Allow auth API, webhooks, and send API without login
  if (isApiAuth || isWebhook || isSendApi) return;

  // Redirect logged-in users away from login page
  if (isLoginPage && isLoggedIn) {
    return Response.redirect(new URL("/", req.nextUrl));
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isLoginPage) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
