import "server-only";
import { BUYBACK_GRACE_SECS } from "@f2f/sdk";
import { TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token";
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

/** USDC in each pool's vault, in one batched account read; missing accounts count as 0. */
export async function vaultBalances(pools: { poolId: string; vault: string }[]): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  for (let i = 0; i < pools.length; i += 100) {
    const chunk = pools.slice(i, i + 100);
    const infos = await getConnection().getMultipleAccountsInfo(chunk.map((p) => new PublicKey(p.vault)), "confirmed");
    chunk.forEach((p, j) => {
      const info = infos[j];
      out.set(p.poolId, info ? unpackAccount(new PublicKey(p.vault), info, TOKEN_PROGRAM_ID).amount : 0n);
    });
  }
  return out;
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
      poolId,
      symbol: detail.pool.instrument?.symbol ?? `POOL-${poolId}`,
      issuer: detail.pool.issuer,
      status: detail.pool.status,
      settlementMode: detail.terms?.settlementMode ?? null,
      election: detail.terms?.election ?? null,
      effectiveElection: o.election,
      lapseTs: detail.pool.maturityTs + BUYBACK_GRACE_SECS,
      allDisbursed: detail.pool.disbursedCount === detail.pool.projectCount,
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
