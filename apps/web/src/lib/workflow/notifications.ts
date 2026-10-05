import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { notifications, type NotificationRow } from "../db/schema";

export async function notify(db: Db, userId: string, kind: string, title: string, body: string): Promise<void> {
  await db.insert(notifications).values({ userId, kind, title, body });
}

export const listNotifications = (db: Db, userId: string, limit = 10): Promise<NotificationRow[]> =>
  db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);

export async function markAllRead(db: Db, userId: string): Promise<void> {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
