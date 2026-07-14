import { APPS } from "./apps";

/**
 * Best-effort cross-service user provisioning. Called after grantAccessAction
 * writes the AppAccess row. If the target app has `syncApi` configured AND
 * INTERNAL_API_TOKEN is set, we POST/DELETE to keep the app's own user table
 * in sync. Non-fatal — logs a warning but doesn't fail the intranet action.
 */

type UserPayload = {
  email: string;
  name: string;
  role: string;
  googleId?: string | null;
  imageUrl?: string | null;
};

function getAppSyncApi(appKey: string): string | null {
  const app = APPS.find((a) => a.key === appKey);
  return app?.syncApi || null;
}

export async function syncGrantToApp(appKey: string, user: UserPayload): Promise<void> {
  const base = getAppSyncApi(appKey);
  const token = process.env.INTERNAL_API_TOKEN?.trim();
  if (!base || !token) return; // app doesn't support sync yet, or no shared token
  try {
    const res = await fetch(`${base}/api/internal/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `[app-sync] grant ${appKey} → ${user.email} returned ${res.status}: ${body.slice(0, 200)}`
      );
    }
  } catch (err) {
    console.warn(
      `[app-sync] grant ${appKey} → ${user.email} failed:`,
      err instanceof Error ? err.message : err
    );
  }
}

export async function syncRevokeFromApp(appKey: string, email: string): Promise<void> {
  const base = getAppSyncApi(appKey);
  const token = process.env.INTERNAL_API_TOKEN?.trim();
  if (!base || !token) return;
  try {
    const res = await fetch(
      `${base}/api/internal/users/${encodeURIComponent(email)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `[app-sync] revoke ${appKey} → ${email} returned ${res.status}: ${body.slice(0, 200)}`
      );
    }
  } catch (err) {
    console.warn(
      `[app-sync] revoke ${appKey} → ${email} failed:`,
      err instanceof Error ? err.message : err
    );
  }
}
