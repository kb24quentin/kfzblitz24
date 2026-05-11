import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const c = await prisma.b2BCase.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!c) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Don't leak file system paths
  const { gewerbescheinPath, assessmentJson, ...rest } = c;
  return NextResponse.json({
    ...rest,
    hasGewerbeschein: !!gewerbescheinPath,
    assessment: assessmentJson ? safeParse(assessmentJson) : null,
  });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
