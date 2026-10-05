import "server-only";
import { and, desc, eq, like } from "drizzle-orm";
import { accruedToDate } from "../accrual";
import type { PoolView } from "../chain/views";
import type { Db } from "../db/client";
import { auditLog, wallets } from "../db/schema";
import { claimableKg, deliveryOpen, payoutForAmount, settlementStatus, tokenCount } from "../instrument-terms";
import { withYield } from "../format";
import { getReader } from "./context";
import type { PositionRow } from "../../components/investor/positions";

export type InvestorHistoryRow = { id: string; at: Date; label: string; pool: string; amount: string | null; tokens: string | null; signature: string | null };

const TX_LABEL: Record<string, string> = { "tx.subscribe": "Subscribed", "tx.refund": "Refunded", "tx.redeem": "Redeemed", "tx.redeem-delivery": "Grain claim" };

function actionFor(p: PoolView, now: number): PositionRow["action"] {
  if (p.status === "Redeeming") return "Redeem";
  if (p.status === "Refunding") return "Refund";
  if (p.terms && deliveryOpen(p, p.terms, now)) return "Claim grain";
  return "View pool";
}

/** Positions across every linked wallet, with accrued coupon and settlement path, plus the transaction history. */
export async function investorPortfolio(db: Db, user: { id: string }, now = Math.floor(Date.now() / 1000)) {
  const reader = getReader();
  const [ws, pools, rows] = await Promise.all([
    db.select().from(wallets).where(eq(wallets.userId, user.id)),
    reader.listPools(),
    db.select().from(auditLog).where(and(eq(auditLog.actorUserId, user.id), like(auditLog.action, "tx.%"))).orderBy(desc(auditLog.createdAt)).limit(200),
  ]);
  const byAddress = new Map(pools.map((p) => [p.address, p]));
  const byId = new Map(pools.map((p) => [p.poolId, p]));
  const states = await Promise.all(ws.map((w) => reader.investor(w.address).catch(() => null)));
  const positions: PositionRow[] = [];
  states.forEach((s, i) => {
    if (!s) return;
    for (const pos of s.positions) {
      const balance = BigInt(pos.balance);
      const p = byId.get(pos.poolId);
      if (balance === 0n || !p) continue;
      const t = p.terms ?? null;
      positions.push({
        poolId: p.poolId,
        symbol: pos.symbol,
        wallet: ws[i]!.address,
        tokens: t ? tokenCount(balance, t).toString() : null,
        holding: balance.toString(),
        accrued: t ? accruedToDate(balance, t.couponBpsAnnual, t.startTs, now, p.maturityTs).toString() : null,
        atMaturity: (t ? payoutForAmount(p, t, balance) : withYield(balance, p.yieldBps)).toString(),
        maturityTs: p.maturityTs,
        settlement: t ? settlementStatus(p, t, now).label : "Principal plus the fixed yield in USDC after maturity",
        grainClaimKg: t && deliveryOpen(p, t, now) ? claimableKg(p, t, balance).toString() : null,
        action: actionFor(p, now),
      });
    }
  });
  const history: InvestorHistoryRow[] = rows.map((r) => {
    const pool = typeof r.payload.pool === "string" ? byAddress.get(r.payload.pool) : undefined;
    const amount = typeof r.payload.amount === "string" ? r.payload.amount : null;
    const t = pool?.terms ?? null;
    return {
      id: r.id,
      at: r.createdAt,
      label: TX_LABEL[r.action] ?? r.action,
      pool: pool?.instrument?.symbol ?? (pool ? `POOL-${pool.poolId}` : "Unknown pool"),
      amount,
      tokens: amount && t ? tokenCount(amount, t).toString() : null,
      signature: r.txSignature,
    };
  });
  return { wallets: ws, states, positions, history, pools };
}
