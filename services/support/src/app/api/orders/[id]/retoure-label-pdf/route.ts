import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Session-authed proxy for the pure DHL-label PDF (only present when
 * label_requested + successfully booked). Falls back to shipping-label
 * endpoint by caseId if the stored URL is missing/relative.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const order = await prisma.ticketOrder.findUnique({
    where: { id },
    select: { retoureCaseId: true, retoureLabelUrl: true, ref: true },
  });
  if (!order?.retoureCaseId) {
    return NextResponse.json({ error: "no_retoure_created" }, { status: 404 });
  }

  const base = (process.env.RETOURE_API_URL || "").replace(/\/+$/, "");
  const token = process.env.RETOURE_API_TOKEN?.trim();
  if (!base || !token) {
    return NextResponse.json({ error: "retoure_not_configured" }, { status: 503 });
  }

  let pdfUrl: string;
  const stored = order.retoureLabelUrl;
  if (stored && /^https?:\/\//i.test(stored)) {
    pdfUrl = stored;
  } else if (stored && stored.startsWith("/")) {
    pdfUrl = `${base}${stored}`;
  } else {
    pdfUrl = `${base}/api/retoure/cases/${order.retoureCaseId}/shipping-label-pdf`;
  }

  let res: Response;
  try {
    res = await fetch(pdfUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (e) {
    return NextResponse.json(
      { error: `fetch_failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
  if (!res.ok) {
    return NextResponse.json({ error: `upstream_${res.status}` }, { status: 502 });
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="DHL-Label-${order.ref}.pdf"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
