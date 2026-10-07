import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { investorProfiles, kfdAcceptances, notifications, type NotificationRow } from "../db/schema";
import { formatDateUtc } from "../format";

export async function notify(db: Db, userId: string, kind: string, title: string, body: string, link?: string): Promise<void> {
  await db.insert(notifications).values({ userId, kind, title, body, link: link ?? null });
}

/** A notification that must exist at most once (the dedupe key is unique). Returns whether it was written now. */
export async function notifyOnce(db: Db, userId: string, dedupeKey: string, kind: string, title: string, body: string, link?: string): Promise<boolean> {
  const rows = await db
    .insert(notifications)
    .values({ userId, kind, title, body, link: link ?? null, dedupeKey })
    .onConflictDoNothing({ target: notifications.dedupeKey, where: sql`"dedupe_key" is not null` })
    .returning({ id: notifications.id });
  return rows.length > 0;
}

async function notifyMany(db: Db, userIds: string[], kind: string, title: string, body: string, link?: string): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length) await db.insert(notifications).values(unique.map((userId) => ({ userId, kind, title, body, link: link ?? null })));
}

/** Investors who accepted the pool's key features document: the people who hold or meant to hold it. */
async function poolInvestors(db: Db, poolAddress: string): Promise<string[]> {
  const rows = await db.select({ id: kfdAcceptances.investorUserId }).from(kfdAcceptances).where(eq(kfdAcceptances.poolAddress, poolAddress));
  return rows.map((r) => r.id);
}

export async function notifyPoolInvestors(db: Db, poolAddress: string, kind: string, title: string, body: string, link?: string): Promise<void> {
  await notifyMany(db, await poolInvestors(db, poolAddress), kind, title, body, link);
}

/** Every investor whose KYC is approved (a new pool opened). */
export async function notifyApprovedInvestors(db: Db, kind: string, title: string, body: string, link?: string): Promise<void> {
  const rows = await db.select({ id: investorProfiles.userId }).from(investorProfiles).where(eq(investorProfiles.kycStatus, "approved"));
  await notifyMany(db, rows.map((r) => r.id), kind, title, body, link);
}

const WEEK = 7 * 86_400;

/**
 * "Maturity in 7 days": computed on cabinet page loads, written once per pool and person (dedupe key), for pools that
 * mature within the next 7 days. Recipients: the pool's investors (KFD acceptors) and its farmer.
 */
export async function maturityReminders(
  db: Db,
  pools: { address: string; poolId: string; symbol: string; maturityTs: number }[],
  nowSec: number,
  farmerOfPool: Map<string, string>,
): Promise<void> {
  for (const p of pools) {
    if (p.maturityTs <= nowSec || p.maturityTs - nowSec > WEEK) continue;
    const people = [...(await poolInvestors(db, p.address)), ...(farmerOfPool.has(p.address) ? [farmerOfPool.get(p.address) as string] : [])];
    for (const userId of new Set(people)) {
      const farmer = farmerOfPool.get(p.address) === userId;
      await notifyOnce(
        db,
        userId,
        `maturity7:${p.address}:${userId}`,
        "maturity",
        `${p.symbol} matures within 7 days`,
        farmer
          ? `Maturity ${formatDateUtc(p.maturityTs)}. Elect buyback or delivery and fund the buyback before then.`
          : `Maturity ${formatDateUtc(p.maturityTs)}. Settlement follows: cash redemption or a grain claim.`,
        farmer ? "/issuer" : `/invest/pools/${p.poolId}`,
      );
    }
  }
}

export const listNotifications = (db: Db, userId: string, limit = 10): Promise<NotificationRow[]> =>
  db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);

export async function unreadCount(db: Db, userId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(row?.n ?? 0);
}

export async function markAllRead(db: Db, userId: string): Promise<void> {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
