import { and, desc, eq, inArray } from "drizzle-orm";
import type { SessionUser } from "../auth/session";
import type { Db } from "../db/client";
import { auditLog, documents, investorProfiles, users, wallets } from "../db/schema";
import { RequestError } from "../errors";
import { farmerKycQueue, investorQueue, type InvestorQueueRow } from "./arranger";
import { audit, audited } from "./audit";
import { assertPermission, assertUuid } from "./guards";
import { notify } from "./notifications";
import type { ArrangerChain } from "./ports";

/** AIFC exempt offer (RETAIL_LIMITS): fewer than 50 retail investors, at least USD 100,000 each, up to USD 5M from retail. */
export const RETAIL_INVESTOR_LIMIT = 50;
export const RETAIL_MIN_PER_INVESTOR = 100_000n * 1_000_000n;
export const RETAIL_TOTAL_CAP = 5_000_000n * 1_000_000n;

export type FarmerKycRow = Awaited<ReturnType<typeof farmerKycQueue>>[number] & { kycDocument: string | null };

export async function complianceQueues(db: Db): Promise<{ farmers: FarmerKycRow[]; investors: InvestorQueueRow[]; approvedInvestors: InvestorQueueRow[] }> {
  const [farmers, investors, approvedInvestors] = await Promise.all([farmerKycQueue(db), investorQueue(db, ["pending"]), investorQueue(db, ["approved"])]);
  const ids = farmers.map((f) => f.profile.userId);
  const docs = ids.length
    ? await db.select({ owner: documents.ownerUserId, sha: documents.sha256, at: documents.createdAt }).from(documents).where(and(inArray(documents.ownerUserId, ids), eq(documents.kind, "kyc"))).orderBy(desc(documents.createdAt))
    : [];
  return { farmers: farmers.map((f) => ({ ...f, kycDocument: docs.find((d) => d.owner === f.profile.userId)?.sha ?? null })), investors, approvedInvestors };
}

/**
 * Revokes an investor's platform KYC: `revoke_investor` for every linked wallet (freezing its Instrument accounts), then
 * the profile is marked rejected with the reason. New subscriptions stop at once; holdings stay frozen until approved again.
 */
export async function revokeInvestor(db: Db, actor: SessionUser, investorUserId: string, reason: string, chain: Pick<ArrangerChain, "revokeKyc">): Promise<void> {
  assertPermission(actor, "kyc.revoke");
  const actingRole = "compliance";
  assertUuid(investorUserId, "Investor");
  const r = reason.trim();
  if (r.length < 3) throw new RequestError("Say why the KYC is revoked.", 400);
  const profile = await db.query.investorProfiles.findFirst({ where: eq(investorProfiles.userId, investorUserId) });
  if (!profile) throw new RequestError("Investor not found", 404);
  if (profile.kycStatus !== "approved") throw new RequestError("Only an approved KYC can be revoked.", 409);
  const ws = await db.select().from(wallets).where(eq(wallets.userId, investorUserId));
  for (const w of ws) {
    await audited(db, { actorUserId: actor.id, actingRole, action: "investor_kyc.revoke", targetType: "user", targetId: investorUserId, payload: { wallet: w.address } }, () => chain.revokeKyc(w.address), (s) => s);
  }
  if (!ws.length) await audit(db, { actorUserId: actor.id, actingRole, action: "investor_kyc.revoke", targetType: "user", targetId: investorUserId, payload: { wallet: null } });
  await db.update(investorProfiles).set({ kycStatus: "rejected", kycNote: `Revoked: ${r}`, decidedBy: actor.id, decidedAt: new Date(), updatedAt: new Date() }).where(eq(investorProfiles.userId, investorUserId));
  await notify(db, investorUserId, "kyc", "KYC revoked", `${r}. Your holdings are frozen; contact the platform.`);
}

export interface RetailMonitorRow {
  poolId: string;
  symbol: string;
  retailInvestors: number;
  limit: number;
  retailTotal: bigint;
  totalCap: bigint;
  investors: { userId: string; email: string; amount: bigint; belowMinimum: boolean }[];
}

/** Retail subscriptions per pool from the sponsored transaction history (tx.subscribe), against the exempt-offer limits. */
export async function retailMonitor(db: Db, pools: { address: string; poolId: string; symbol: string }[]): Promise<RetailMonitorRow[]> {
  const subs = await db.select({ userId: auditLog.actorUserId, payload: auditLog.payload }).from(auditLog).where(eq(auditLog.action, "tx.subscribe"));
  const ids = [...new Set(subs.map((s) => s.userId).filter((x): x is string => Boolean(x)))];
  const retail = ids.length
    ? await db
        .select({ userId: investorProfiles.userId, email: users.email })
        .from(investorProfiles)
        .innerJoin(users, eq(users.id, investorProfiles.userId))
        .where(and(inArray(investorProfiles.userId, ids), eq(investorProfiles.category, "retail")))
    : [];
  const emailOf = new Map(retail.map((r) => [r.userId, r.email]));
  return pools.map((p) => {
    const sums = new Map<string, bigint>();
    for (const s of subs) {
      if (!s.userId || !emailOf.has(s.userId) || s.payload.pool !== p.address || typeof s.payload.amount !== "string") continue;
      sums.set(s.userId, (sums.get(s.userId) ?? 0n) + BigInt(s.payload.amount));
    }
    const investors = [...sums].map(([userId, amount]) => ({ userId, email: emailOf.get(userId) as string, amount, belowMinimum: amount < RETAIL_MIN_PER_INVESTOR }));
    return {
      poolId: p.poolId,
      symbol: p.symbol,
      retailInvestors: investors.length,
      limit: RETAIL_INVESTOR_LIMIT,
      retailTotal: investors.reduce((a, x) => a + x.amount, 0n),
      totalCap: RETAIL_TOTAL_CAP,
      investors,
    };
  });
}
