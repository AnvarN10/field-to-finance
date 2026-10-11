import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { SessionUser } from "../auth/session";
import type { Db } from "../db/client";
import { INVESTOR_CATEGORIES, investorProfiles, kfdAcceptances, wallets, type InvestorProfileRow, type KycStatus, type WalletKind } from "../db/schema";
import { RequestError } from "../errors";
import { COUNTRIES } from "../kyc";
import { audit, audited } from "./audit";
import { assertAccount, parseOr400 } from "./guards";
import type { ArrangerChain } from "./ports";

const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** AIFC exempt offer limits for retail clients (docs/business/legal-structure.md, MAR 1.1.2). */
export const RETAIL_LIMITS =
  "Retail limits for this exempt offer: fewer than 50 retail investors in 12 months, USD 100,000 minimum per investor, up to USD 5M from retail investors in 12 months.";

export const questionnaireInput = z
  .object({
    category: z.enum(INVESTOR_CATEGORIES, { error: "choose a category" }),
    netAssets: z.enum(["under-100k", "100k-1m", "1m-10m", "over-10m"], { error: "choose a range" }),
    experience: z.enum(["none", "some", "extensive"], { error: "choose your experience" }),
    basis: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.category === "retail" || (v.basis !== undefined && v.basis.length >= 2), {
    message: "say why you qualify as a professional or institutional investor",
    path: ["basis"],
  });

export const investorKycInput = z.object({
  fullName: z.string().trim().min(2, "enter your full name").max(80),
  country: z.enum(COUNTRIES, { error: "choose a country" }),
  /** Kazakhstan individual identification number; optional, kept in Postgres for compliance and the regulator. */
  iin: z.string().trim().regex(/^\d{12}$/, "the IIN has 12 digits").optional(),
});

async function profileOf(db: Db, userId: string): Promise<InvestorProfileRow | undefined> {
  return db.query.investorProfiles.findFirst({ where: eq(investorProfiles.userId, userId) });
}

async function upsertProfile(db: Db, userId: string, set: Partial<typeof investorProfiles.$inferInsert>): Promise<InvestorProfileRow> {
  const [row] = await db
    .insert(investorProfiles)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: investorProfiles.userId, set: { ...set, updatedAt: new Date() } })
    .returning();
  return row as InvestorProfileRow;
}

export async function saveQuestionnaire(db: Db, user: SessionUser, input: unknown): Promise<InvestorProfileRow> {
  assertAccount(user, "investor");
  const v = parseOr400(questionnaireInput, input);
  const current = await profileOf(db, user.id);
  if (current?.kycStatus === "approved" && current.category !== v.category) throw new RequestError("Your category was approved. Ask an arranger to change it.", 409);
  const { category, ...answers } = v;
  return upsertProfile(db, user.id, { category, questionnaire: { ...(current?.questionnaire ?? {}), answers } });
}

/** Mock KYC: name and country are kept in Postgres for the arranger's review; no provider is called. */
export async function submitInvestorKyc(db: Db, user: SessionUser, input: unknown): Promise<InvestorProfileRow> {
  assertAccount(user, "investor");
  const v = parseOr400(investorKycInput, input);
  const current = await profileOf(db, user.id);
  if (!current?.category) throw new RequestError("Answer the categorization questionnaire first.", 409);
  if (current.kycStatus === "approved") throw new RequestError("Your KYC is already approved.", 409);
  const row = await upsertProfile(db, user.id, { questionnaire: { ...current.questionnaire, kyc: { ...v, submittedAt: new Date().toISOString() } }, kycStatus: "pending", kycNote: null });
  await audit(db, { actorUserId: user.id, action: "investor_kyc.submit", targetType: "user", targetId: user.id, payload: { category: current.category } });
  return row;
}

export async function acknowledgeRisk(db: Db, user: SessionUser): Promise<InvestorProfileRow> {
  assertAccount(user, "investor");
  const current = await profileOf(db, user.id);
  if (!current?.category) throw new RequestError("Answer the categorization questionnaire first.", 409);
  return upsertProfile(db, user.id, { riskAckAt: new Date() });
}

/**
 * Links a wallet to the account. A wallet belongs to one account only, so KYC and KFD gates cannot be borrowed.
 * With `chain`, an already approved investor's new wallet is approved on-chain at once.
 */
export async function linkWallet(db: Db, user: SessionUser, w: { address: string; kind: WalletKind }, chain?: Pick<ArrangerChain, "approveKyc">): Promise<void> {
  if (!WALLET.test(w.address)) throw new RequestError("Invalid wallet address", 400);
  const existing = await db.query.wallets.findFirst({ where: eq(wallets.address, w.address) });
  if (existing && existing.userId !== user.id) throw new RequestError("This wallet is linked to another account.", 409);
  if (!existing) {
    await db.insert(wallets).values({ address: w.address, userId: user.id, kind: w.kind });
    await audit(db, { actorUserId: user.id, action: "wallet.link", targetType: "user", targetId: user.id, payload: { wallet: w.address, kind: w.kind } });
  }
  const profile = await profileOf(db, user.id);
  if (chain && profile?.kycStatus === "approved") {
    await audited(db, { actorUserId: user.id, action: "investor_kyc.approve_wallet", targetType: "user", targetId: user.id, payload: { wallet: w.address } }, () => chain.approveKyc(w.address), (s) => [s]);
  }
}

export async function acceptKfd(db: Db, user: SessionUser, poolAddress: string, documentHash: string): Promise<void> {
  assertAccount(user, "investor");
  if (!WALLET.test(poolAddress)) throw new RequestError("Invalid pool", 400);
  if (!/^[0-9a-f]{64}$/.test(documentHash)) throw new RequestError("Invalid document hash", 400);
  const p = await profileOf(db, user.id);
  if (p?.kycStatus !== "approved" || !p.riskAckAt) throw new RequestError("Finish onboarding first: KYC approval and the risk acknowledgement.", 409);
  await db
    .insert(kfdAcceptances)
    .values({ investorUserId: user.id, poolAddress, documentHash })
    .onConflictDoUpdate({ target: [kfdAcceptances.investorUserId, kfdAcceptances.poolAddress], set: { documentHash, acceptedAt: new Date() } });
  await audit(db, { actorUserId: user.id, action: "kfd.accept", targetType: "pool", targetId: poolAddress, payload: { documentHash } });
}

export async function hasKfd(db: Db, userId: string, poolAddress: string): Promise<{ documentHash: string; acceptedAt: Date } | null> {
  const row = await db.query.kfdAcceptances.findFirst({ where: and(eq(kfdAcceptances.investorUserId, userId), eq(kfdAcceptances.poolAddress, poolAddress)) });
  return row ? { documentHash: row.documentHash, acceptedAt: row.acceptedAt } : null;
}

export type KfdGate = null | "unlinked" | "other_account" | "onboarding" | "kfd";

/**
 * Whether `wallet` may subscribe to `poolAddress`: linked to an account, onboarded (KYC approved, risk acknowledged), KFD
 * accepted. With `sessionUserId` (someone is signed in) the wallet must also be linked to that account: otherwise a
 * Phantom approved under one account would buy for whoever is signed in, and the position would land with its owner.
 */
export async function kfdGate(db: Db, wallet: string, poolAddress: string, sessionUserId: string | null = null): Promise<KfdGate> {
  const w = await db.query.wallets.findFirst({ where: eq(wallets.address, wallet) });
  if (!w) return "unlinked";
  if (sessionUserId && w.userId !== sessionUserId) return "other_account";
  const p = await profileOf(db, w.userId);
  if (p?.kycStatus !== "approved" || !p.riskAckAt) return "onboarding";
  return (await hasKfd(db, w.userId, poolAddress)) ? null : "kfd";
}

export interface InvestorOnboarding {
  category: InvestorProfileRow["category"];
  questionnaireDone: boolean;
  kycStatus: KycStatus;
  kycNote: string | null;
  riskAcknowledged: boolean;
  wallets: { address: string; kind: WalletKind }[];
  retailLimits: string | null;
  complete: boolean;
}

export async function investorOnboarding(db: Db, userId: string): Promise<InvestorOnboarding> {
  const [p, ws] = await Promise.all([profileOf(db, userId), db.select().from(wallets).where(eq(wallets.userId, userId))]);
  const kycStatus = p?.kycStatus ?? "not_started";
  const riskAcknowledged = Boolean(p?.riskAckAt);
  return {
    category: p?.category ?? null,
    questionnaireDone: Boolean(p?.category),
    kycStatus,
    kycNote: p?.kycNote ?? null,
    riskAcknowledged,
    wallets: ws.map((w) => ({ address: w.address, kind: w.kind })),
    retailLimits: p?.category === "retail" ? RETAIL_LIMITS : null,
    complete: Boolean(p?.category) && kycStatus === "approved" && riskAcknowledged && ws.length > 0,
  };
}
