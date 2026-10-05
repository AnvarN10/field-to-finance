import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { PoolView } from "../chain/views";
import type { Db } from "../db/client";
import { auditLog, farmerProfiles, investorProfiles, wallets } from "../db/schema";

/**
 * The regulator's read-only registry. BIN and IIN appear here (Postgres only, never on-chain); emails, names, KYC
 * answers and review notes never do.
 */
export interface RegistryRow {
  poolId: string;
  symbol: string;
  status: string;
  issuerWallet: string;
  issuerLegalName: string | null;
  issuerBin: string | null;
  raised: string;
  target: string;
  couponBps: number | null;
  settlementMode: string | null;
  maturityTs: number;
  /** null when the holders could not be read (RPC rate limit). */
  holders: number | null;
}

export async function registryRows(db: Db, pools: PoolView[], holderCounts: Map<string, number>): Promise<RegistryRow[]> {
  const issuers = [...new Set(pools.map((p) => p.issuer))];
  const profiles = issuers.length ? await db.select({ wallet: farmerProfiles.kycWallet, legalName: farmerProfiles.legalName, bin: farmerProfiles.bin }).from(farmerProfiles).where(inArray(farmerProfiles.kycWallet, issuers)) : [];
  const byWallet = new Map(profiles.map((p) => [p.wallet as string, p]));
  return pools.map((p) => ({
    poolId: p.poolId,
    symbol: p.instrument?.symbol ?? `POOL-${p.poolId}`,
    status: p.status,
    issuerWallet: p.issuer,
    issuerLegalName: byWallet.get(p.issuer)?.legalName ?? null,
    issuerBin: byWallet.get(p.issuer)?.bin ?? null,
    raised: p.raisedAmount,
    target: p.targetAmount,
    couponBps: p.terms?.couponBpsAnnual ?? null,
    settlementMode: p.terms?.settlementMode ?? null,
    maturityTs: p.maturityTs,
    holders: holderCounts.get(p.poolId) ?? null,
  }));
}

export interface HolderRow {
  poolId: string;
  wallet: string;
  balance: string;
  category: string | null;
  iin: string | null;
}

/** Token holders joined with the owning investor's category and IIN (if given); unlinked wallets stay anonymous. */
export async function holderRows(db: Db, holders: { poolId: string; wallet: string; balance: string }[]): Promise<HolderRow[]> {
  const addresses = [...new Set(holders.map((h) => h.wallet))];
  const owned = addresses.length
    ? await db
        .select({ wallet: wallets.address, category: investorProfiles.category, questionnaire: investorProfiles.questionnaire })
        .from(wallets)
        .leftJoin(investorProfiles, eq(investorProfiles.userId, wallets.userId))
        .where(inArray(wallets.address, addresses))
    : [];
  const byWallet = new Map(owned.map((o) => [o.wallet, o]));
  return holders.map((h) => {
    const o = byWallet.get(h.wallet);
    const iin = (o?.questionnaire as { kyc?: { iin?: unknown } } | null | undefined)?.kyc?.iin;
    return { poolId: h.poolId, wallet: h.wallet, balance: h.balance, category: o?.category ?? null, iin: typeof iin === "string" ? iin : null };
  });
}

/** Payload keys that describe what happened without personal data or review notes. */
export const EVENT_KEYS = ["amount", "election", "from", "kind", "pool", "poolId", "project", "rule", "symbol", "to", "verdict", "yieldEstimateTPerHa"] as const;

export interface EventRow {
  at: string;
  action: string;
  actingRole: string | null;
  targetType: string;
  targetId: string;
  signature: string | null;
  detail: string;
}

/**
 * Events, newest first. For one pool the filter runs in SQL, so a pool's whole history comes back however many other rows
 * exist; across every pool the latest `limit` rows (default 1000).
 */
export async function eventRows(db: Db, f: { poolId?: string; poolAddress?: string; limit?: number }): Promise<EventRow[]> {
  const ofPool = f.poolId
    ? or(
        and(eq(auditLog.targetType, "pool"), eq(auditLog.targetId, f.poolId)),
        sql`${auditLog.payload}->>'poolId' = ${f.poolId}`,
        ...(f.poolAddress ? [sql`${auditLog.payload}->>'pool' = ${f.poolAddress}`] : []),
      )
    : undefined;
  const base = db.select().from(auditLog).where(and(sql`not (${auditLog.payload} ? 'error')`, ofPool)).orderBy(desc(auditLog.createdAt));
  const rows = f.poolId ? await base : await base.limit(Math.min(f.limit ?? 1000, 5000));
  return rows
    .map((r) => ({
      at: r.createdAt.toISOString(),
      action: r.action,
      actingRole: r.actingRole,
      // Users are referred to by role in the export, never by id or email.
      targetType: r.targetType,
      targetId: r.targetType === "user" ? "" : r.targetId,
      signature: r.txSignature,
      detail: EVENT_KEYS.filter((k) => r.payload[k] !== undefined && typeof r.payload[k] !== "object")
        .map((k) => `${k}=${String(r.payload[k])}`)
        .join("; "),
    }));
}

/** Registry filters. `holdersByIin` maps an IIN to the pools its wallets hold. */
export function filterRegistry(rows: RegistryRow[], f: { status?: string; poolId?: string; bin?: string; iin?: string; holdersByIin?: Map<string, Set<string>> }): RegistryRow[] {
  return rows.filter(
    (r) =>
      (!f.status || r.status === f.status) &&
      (!f.poolId || r.poolId === f.poolId) &&
      (!f.bin || r.issuerBin === f.bin.trim()) &&
      (!f.iin || (f.holdersByIin?.get(f.iin.trim())?.has(r.poolId) ?? false)),
  );
}
