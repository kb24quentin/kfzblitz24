import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/db";

interface ResendEvent {
  type: string;
  data: {
    email_id?: string;
    [key: string]: unknown;
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  let event: ResendEvent;

  if (secret) {
    const wh = new Webhook(secret);
    const headers = {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    };
    try {
      event = wh.verify(rawBody, headers) as ResendEvent;
    } catch (err) {
      console.error("[resend-webhook] signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — accepting unauthenticated POST");
    try {
      event = JSON.parse(rawBody) as ResendEvent;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const { type, data } = event;
  if (!data?.email_id) {
    return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
  }

  const email = await prisma.email.findFirst({
    where: { resendEmailId: data.email_id },
  });

  if (!email) {
    // Webhook may fire for emails not in our DB (test events, manually-sent, etc).
    // Return 200 so Resend doesn't keep retrying.
    return NextResponse.json({ received: true, ignored: "unknown email_id" });
  }

  try {
    switch (type) {
      case "email.delivered":
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "delivered" },
        });
        break;

      case "email.opened":
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "opened", openedAt: new Date() },
        });
        break;

      case "email.clicked":
        await prisma.email.update({
          where: { id: email.id },
          data: { clickedAt: new Date() },
        });
        break;

      case "email.bounced":
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "bounced" },
        });
        await prisma.contact.update({
          where: { id: email.contactId },
          data: { status: "not_interested" },
        });
        break;

      case "email.complained":
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "bounced" },
        });
        break;
    }

    return NextResponse.json({ received: true, type });
  } catch (error) {
    console.error("[resend-webhook] DB update failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
