import { checkBearer } from "@/lib/api-auth";
import { syncGmailInbox } from "@/lib/gmail-sync";
import { isGmailConfigured } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = checkBearer(req);
  if (!auth.ok) return new Response("Unauthorized", { status: auth.status });

  if (process.env.DISABLE_GMAIL_SYNC === "true") {
    return Response.json(
      { ok: false, skipped: true, reason: "sync disabled via DISABLE_GMAIL_SYNC" },
      { status: 200 }
    );
  }

  if (!(await isGmailConfigured())) {
    return Response.json(
      { ok: false, skipped: true, reason: "gmail not configured" },
      { status: 200 }
    );
  }

  try {
    const started = Date.now();
    const result = await syncGmailInbox();
    return Response.json({
      ok: true,
      durationMs: Date.now() - started,
      ...result,
    });
  } catch (err) {
    console.error("[cron/gmail-sync] failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
