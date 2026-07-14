import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { disconnectGmail } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Not authenticated", { status: 401 });
  }
  await disconnectGmail();
  const url =
    (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "") +
    "/settings?gmail=disconnected";
  return NextResponse.redirect(url, 303);
}
