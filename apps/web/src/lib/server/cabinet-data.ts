import "server-only";
import { PublicKey } from "@solana/web3.js";
import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { obligation } from "../accrual";
import type { PoolDetail } from "../chain/views";
import type { Db } from "../db/client";
import { auditLog, type AuditRow } from "../db/schema";
import type { ObligationItem } from "../../components/farmer/obligations";
import { getConnection, getReader } from "./context";

export async function vaultBalance(vault: string): Promise<bigint> {
  try {
    return BigInt((await getConnection().getTokenAccountBalance(new PublicKey(vault), "confirmed")).value.amount);
  } catch {
    return 0n;
  }
}

/** The issuer's obligation on one pool, serialized for client components; null when the pool cannot be read. */
export async function poolObligation(poolId: string, nowSec: number): Promise<{ item: ObligationItem; detail: PoolDetail } | null> {
  const detail = await getReader().getPool(poolId).catch(() => null);
  if (!detail || detail.pool.status === "Draft") return null;
  const vault = await vaultBalance(detail.pool.vault);
  const o = obligation({ pool: detail.pool, terms: detail.terms }, vault, nowSec);
  return {
    detail,
    item: {
      symbol: detail.pool.instrument?.symbol ?? `POOL-${poolId}`,
      principal: o.principal.toString(),
      dueAtMaturity: o.dueAtMaturity.toString(),
      accrued: o.accrued === null ? null : o.accrued.toString(),
      maturityTs: o.maturityTs,
      settlementLabel: o.settlementLabel,
      vaultBalance: o.vaultBalance.toString(),
      buybackShortfall: o.buybackShortfall.toString(),
    },
  };
}

/** On-chain events that touch a farmer: registration and other own transactions, plus pool actions on their pools. */
export async function farmerHistory(db: Db, userId: string, poolIds: string[]): Promise<AuditRow[]> {
  const poolActions = ["pool.disburse", "pool.open", "pool.close_subscription", "pool.fund_redemption", "pool.elect_settlement", "pool.record_delivery", "pool.sweep"];
  return db
    .select()
    .from(auditLog)
    .where(
      or(
        and(eq(auditLog.actorUserId, userId), like(auditLog.action, "tx.%")),
        poolIds.length ? and(eq(auditLog.targetType, "pool"), inArray(auditLog.targetId, poolIds), inArray(auditLog.action, poolActions)) : undefined,
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(50);
}
