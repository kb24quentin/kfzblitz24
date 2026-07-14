import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeCodeAndStore } from "@/lib/gmail";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  return (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
}

function buildRedirect(status: "ok" | "error", detail: string) {
  const url = new URL(`${baseUrl()}/settings`);
  url.searchParams.set("gmail", status);
  url.searchParams.set("detail", detail);
  return NextResponse.redirect(url.toString());
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

  if (error) return buildRedirect("error", `google_error:${error}`);
  if (!code || !stateParam) return buildRedirect("error", "missing_code_or_state");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("gmail_oauth_state")?.value;
  if (!stateCookie || stateCookie !== stateParam) {
    return buildRedirect("error", "state_mismatch");
  }

  try {
    const result = await exchangeCodeAndStore(code);
    const res = buildRedirect("ok", encodeURIComponent(result.email));
    res.cookies.delete("gmail_oauth_state");
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return buildRedirect("error", encodeURIComponent(msg.slice(0, 200)));
  }
}
