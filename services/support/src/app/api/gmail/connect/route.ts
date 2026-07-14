import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAuthUrl, hasOAuthApp, getRedirectUri } from "@/lib/gmail";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Not authenticated", { status: 401 });
  }

  if (!hasOAuthApp()) {
    return new Response(
      `Gmail OAuth client not configured. Set GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET in .env, and add ${getRedirectUri()} as authorized redirect URI in Google Cloud Console.`,
      { status: 503 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const url = buildAuthUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
