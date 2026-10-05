import * as Sentry from "@sentry/nextjs";
import { isCrossSite } from "@/lib/same-origin";
import { currentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { remindMaturities } from "@/lib/server/reminders";
import { listNotifications, markAllRead, unreadCount } from "@/lib/workflow/notifications";

export const dynamic = "force-dynamic";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** The signed-in user's unread count and latest notifications (the bell in every cabinet). */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return json(401, { ok: false, error: "Sign in again." });
    const db = await getDb();
    await remindMaturities(db).catch((e) => Sentry.captureException(e));
    const [unread, items] = await Promise.all([unreadCount(db, user.id), listNotifications(db, user.id, 8)]);
    return json(200, { ok: true, unread, items: items.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, readAt: n.readAt, createdAt: n.createdAt })) });
  } catch {
    return json(503, { ok: false, error: "Notifications are unavailable right now." });
  }
}

/** Marks the caller's notifications read. Same-origin only. */
export async function POST(req: Request) {
  if (isCrossSite(req)) return json(403, { ok: false, error: "Use the Field-to-Finance site." });
  try {
    const user = await currentUser();
    if (!user) return json(401, { ok: false, error: "Sign in again." });
    await markAllRead(await getDb(), user.id);
    return json(200, { ok: true });
  } catch {
    return json(503, { ok: false, error: "Notifications are unavailable right now." });
  }
}
