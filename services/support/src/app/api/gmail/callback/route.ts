import { auth } from "@/lib/auth";
import { exchangeCodeAndStore } from "@/lib/gmail";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  return (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
}

function redirectWithFlash(status: "ok" | "error", detail: string) {
  const url = new URL(`${baseUrl()}/settings`);
  url.searchParams.set("gmail", status);
  url.searchParams.set("detail", detail);
  return Response.redirect(url.toString());
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Not authenticated", { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return redirectWithFlash("error", `google_error:${error}`);
  if (!code || !stateParam) return redirectWithFlash("error", "missing_code_or_state");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("gmail_oauth_state")?.value;
  if (!stateCookie || stateCookie !== stateParam) {
    return redirectWithFlash("error", "state_mismatch");
  }

  try {
    const result = await exchangeCodeAndStore(code);
    // Clear state cookie
    const res = redirectWithFlash("ok", encodeURIComponent(result.email));
    res.headers.append(
      "Set-Cookie",
      "gmail_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return redirectWithFlash("error", encodeURIComponent(msg.slice(0, 200)));
  }
}
