import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/db";

interface ResendEvent {
  type: string;
  data: Record<string, unknown> & {
    email_id?: string;
    from?: string | { email?: string; address?: string };
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
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
  console.log(`[resend-webhook] event=${type}`);

  try {
    // ─── Inbound (replies received via Resend Inbound) ──────────────────
    if (type === "email.received" || type === "email.inbound" || type === "email.inbound.created") {
      console.log("[resend-webhook] inbound payload:", JSON.stringify(data, null, 2));
      return await handleInbound(data);
    }

    // ─── Outbound delivery events (need email_id) ───────────────────────
    if (!data?.email_id) {
      console.log(`[resend-webhook] event ${type} has no email_id, ignoring`);
      return NextResponse.json({ received: true, ignored: "no email_id" });
    }

    const email = await prisma.email.findFirst({
      where: { resendEmailId: data.email_id },
    });

    if (!email) {
      return NextResponse.json({ received: true, ignored: "unknown email_id" });
    }

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

      default:
        console.log(`[resend-webhook] unhandled event type: ${type}`, JSON.stringify(data, null, 2));
    }

    return NextResponse.json({ received: true, type });
  } catch (error) {
    console.error("[resend-webhook] handler error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────────────
// Inbound reply handling
// ────────────────────────────────────────────────────────────────────────
function extractFromEmail(from: unknown): string | null {
  if (typeof from === "string") {
    // "Name <email@x.com>" → email@x.com  |  or just "email@x.com"
    const match = from.match(/<([^>]+)>/);
    return (match ? match[1] : from).trim().toLowerCase();
  }
  if (from && typeof from === "object") {
    const f = from as { email?: string; address?: string };
    return (f.email || f.address || null)?.toLowerCase() ?? null;
  }
  return null;
}

function extractInReplyTo(headers: unknown): string | null {
  if (!headers || typeof headers !== "object") return null;
  const h = headers as Record<string, string>;
  // Headers are case-insensitive in MIME; check common variants
  return (
    h["in-reply-to"] ||
    h["In-Reply-To"] ||
    h["IN-REPLY-TO"] ||
    null
  );
}

async function handleInbound(data: ResendEvent["data"]) {
  const fromEmail = extractFromEmail(data.from);
  const subject = data.subject ?? null;
  const body = (data.text as string) || (data.html as string) || "";
  const inReplyTo = extractInReplyTo(data.headers);

  if (!fromEmail) {
    console.warn("[resend-webhook] inbound: no from address");
    return NextResponse.json({ received: true, ignored: "no from" });
  }

  // 1. Find the contact by sender email
  const contact = await prisma.contact.findUnique({ where: { email: fromEmail } });
  if (!contact) {
    console.warn(`[resend-webhook] inbound: no contact for ${fromEmail}`);
    return NextResponse.json({ received: true, ignored: "unknown contact", from: fromEmail });
  }

  // 2. Find the original email this is replying to.
  //    Strategy: most-recently-sent email to that contact in the last 90 days.
  const original = await prisma.email.findFirst({
    where: {
      contactId: contact.id,
      sentAt: { not: null },
    },
    orderBy: { sentAt: "desc" },
  });

  if (!original) {
    console.warn(`[resend-webhook] inbound: no prior email to ${fromEmail}, can't link reply`);
    return NextResponse.json({ received: true, ignored: "no prior email" });
  }

  // 3. Create the reply record
  const reply = await prisma.reply.create({
    data: {
      emailId: original.id,
      contactId: contact.id,
      fromEmail,
      subject,
      body,
    },
  });

  // 4. Update the original email status
  await prisma.email.update({
    where: { id: original.id },
    data: { status: "replied", repliedAt: new Date() },
  });

  // 5. Update contact status
  await prisma.contact.update({
    where: { id: contact.id },
    data: { status: "replied" },
  });

  console.log(`[resend-webhook] inbound: reply ${reply.id} from ${fromEmail} linked to email ${original.id}`);
  return NextResponse.json({
    received: true,
    type: "inbound",
    replyId: reply.id,
    inReplyTo,
  });
}
