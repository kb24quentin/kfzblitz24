import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Resend webhook handler for tracking email events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (!data?.email_id) {
      return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
    }

    // Find the email by resend email ID
    const email = await prisma.email.findFirst({
      where: { resendEmailId: data.email_id },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
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
        // Update contact status
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

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
