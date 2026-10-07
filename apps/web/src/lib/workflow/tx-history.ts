import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { wallets } from "../db/schema";
import { audit } from "./audit";
import { notify, notifyPoolInvestors } from "./notifications";

export interface UserTx {
  action: string;
  wallet: string;
  signature: string;
  pool: string | null;
  project: string | null;
  amount: string | null;
}

/** What the wallet's owner is told after each sponsored transaction (title prefix, body, and whether the pool's investors hear too). */
const MESSAGES: Record<string, { title: string; body: string; investors?: string }> = {
  subscribe: { title: "Subscription confirmed", body: "Your tokens are in your wallet. Coupon accrues from the interest start." },
  refund: { title: "Refund received", body: "The pool did not reach its target; your USDC is back in your wallet." },
  redeem: { title: "Redemption paid", body: "Principal and coupon arrived in your wallet in USDC." },
  "redeem-delivery": { title: "Grain claim recorded", body: "Your Grain Claim is on-chain. The certificate is in your portfolio." },
  "elect-settlement": { title: "Settlement elected", body: "Your election is recorded on-chain.", investors: "The issuer made its settlement election. Check the settlement path in your portfolio." },
  "fund-redemption": { title: "Buyback funded", body: "Your deposit is in the pool vault.", investors: "The issuer funded the buyback. Redemption opens after maturity." },
};

/** A user transaction the sponsor co-signed: `tx.<action>` in the audit log (the cabinets' history) and a notification. */
export async function recordUserTransaction(db: Db, t: UserTx, pool: { poolId: string; symbol: string } | null): Promise<void> {
  const owner = await db.query.wallets.findFirst({ where: eq(wallets.address, t.wallet) });
  await audit(db, {
    actorUserId: owner?.userId ?? null,
    action: `tx.${t.action}`,
    targetType: "wallet",
    targetId: t.wallet,
    payload: { ...(t.pool ? { pool: t.pool } : {}), ...(t.project ? { project: t.project } : {}), ...(t.amount ? { amount: t.amount } : {}) },
    signatures: [t.signature],
  });
  const m = MESSAGES[t.action];
  if (!m) return;
  const suffix = pool ? `: ${pool.symbol}` : "";
  if (owner) await notify(db, owner.userId, "transaction", `${m.title}${suffix}`, m.body, pool ? (t.action.startsWith("elect") || t.action.startsWith("fund") ? "/issuer" : `/invest/pools/${pool.poolId}`) : undefined);
  if (m.investors && t.pool) await notifyPoolInvestors(db, t.pool, "pool", `${m.title}${suffix}`, m.investors, pool ? `/invest/pools/${pool.poolId}` : undefined);
}
