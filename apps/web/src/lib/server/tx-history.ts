import "server-only";
import { eq } from "drizzle-orm";
import { wallets } from "../db/schema";
import { audit } from "../workflow/audit";
import { getDb } from "./db";

/** A user transaction the sponsor co-signed, in the audit log as `tx.<action>` (the investor and farmer history read it). */
export async function recordUserTx(t: { action: string; wallet: string; signature: string; pool: string | null; project: string | null; amount: string | null }): Promise<void> {
  const db = await getDb();
  const owner = await db.query.wallets.findFirst({ where: eq(wallets.address, t.wallet) });
  await audit(db, {
    actorUserId: owner?.userId ?? null,
    action: `tx.${t.action}`,
    targetType: "wallet",
    targetId: t.wallet,
    payload: { ...(t.pool ? { pool: t.pool } : {}), ...(t.project ? { project: t.project } : {}), ...(t.amount ? { amount: t.amount } : {}) },
    signatures: [t.signature],
  });
}
