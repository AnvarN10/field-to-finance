import type { Program } from "@anchor-lang/core";
import { MAX_ARRANGEMENT_BPS, MAX_EVIDENCE_URI_LEN, poolPda, type F2f } from "@f2f/sdk";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { z } from "zod";
import { RequestError } from "../errors";
import { withYield } from "../format";
import { poolStatusFromAnchor, type SettlementRuleName } from "./enums";
import {
  addProjectIx,
  approveInvestorIx,
  closeSubscriptionIx,
  createPoolIx,
  createUsdcAtaIx,
  disburseIx,
  fundRedemptionIx,
  instrumentAta,
  mintUsdcIx,
  openPoolIx,
  recordSettlementIx,
  revokeInvestorIx,
  setArrangementFeeIx,
  sweepIx,
  usdcAta,
} from "./ix";
import type { ConfigView, FeeView, PoolAccount, ProjectAccount } from "./views";

export interface OpsContext {
  program: Program<F2f>;
  usdcMint: PublicKey;
  roles: { readonly issuer: PublicKey; readonly compliance: PublicKey; readonly deployer: PublicKey };
  send(role: "issuer" | "compliance" | "deployer", ixs: TransactionInstruction[]): Promise<string>;
  loadPool(poolId: bigint): Promise<PoolAccount>;
  loadProjects(pool: PublicKey): Promise<{ address: PublicKey; account: ProjectAccount }[]>;
  tokenBalance(account: PublicKey): Promise<bigint>;
  accountExists(account: PublicKey): Promise<boolean>;
  /** FeeConfig (ADR 0013), or null while fees are not configured. */
  loadFees(): Promise<FeeView | null>;
  now(): number;
}

export const createPoolInput = z
  .object({
    poolId: z.string().regex(/^\d{1,20}$/, "must be a whole number"),
    crop: z.string().trim().min(1).max(16),
    season: z.number().int().min(2025).max(2100),
    name: z.string().trim().min(1).max(32),
    symbol: z.string().trim().min(1).max(10),
    yieldBps: z.number().int().min(0).max(5_000),
    premiumBps: z.number().int().min(500, "premium must be at least 5%").max(600, "premium must be at most 6%"),
    /** ADR 0013: withheld from each project at disbursement. */
    arrangementFeeBps: z.number().int().min(0).max(MAX_ARRANGEMENT_BPS, `arrangement fee must be at most ${MAX_ARRANGEMENT_BPS / 100}%`),
    closeInMinutes: z.number().int().min(1).max(60 * 24 * 30),
    maturityInMinutes: z.number().int().min(2).max(60 * 24 * 365),
  })
  .refine((v) => v.maturityInMinutes > v.closeInMinutes, { message: "maturity must be after subscription close", path: ["maturityInMinutes"] });
export type CreatePoolInput = z.infer<typeof createPoolInput>;

const poolKey = (ctx: OpsContext, poolId: bigint) => poolPda(ctx.program.programId, poolId);

export async function createPool(ctx: OpsContext, input: CreatePoolInput, publicBaseUrl: string) {
  const poolId = BigInt(input.poolId);
  const uri = `${publicBaseUrl.replace(/\/+$/, "")}/api/instrument/${input.poolId}`;
  if (uri.length > MAX_EVIDENCE_URI_LEN) throw new RequestError("Instrument URI is too long; shorten PUBLIC_BASE_URL", 422);
  await assertArrangementFee(ctx, input.arrangementFeeBps);
  const now = ctx.now();
  const ix = await createPoolIx(ctx.program, {
    issuer: ctx.roles.issuer,
    usdcMint: ctx.usdcMint,
    poolId,
    crop: input.crop,
    season: input.season,
    name: input.name,
    symbol: input.symbol,
    uri,
    yieldBps: input.yieldBps,
    premiumBps: input.premiumBps,
    subscriptionCloseTs: now + input.closeInMinutes * 60,
    maturityTs: now + input.maturityInMinutes * 60,
  });
  const ixs = [ix];
  // Same transaction: the pool is Draft right after create_pool, which set_arrangement_fee requires.
  if (input.arrangementFeeBps > 0) {
    ixs.push(await setArrangementFeeIx(ctx.program, { issuer: ctx.roles.issuer, pool: poolKey(ctx, poolId), bps: input.arrangementFeeBps }));
  }
  const signature = await ctx.send("issuer", ixs);
  return { signature, poolId: input.poolId, pool: poolKey(ctx, poolId).toBase58() };
}

async function assertArrangementFee(ctx: OpsContext, bps: number): Promise<void> {
  if (bps === 0) return;
  const fees = await ctx.loadFees();
  if (!fees) throw new RequestError("Fees are not configured on-chain yet (init_fee_config); set the arrangement fee to 0", 422);
  if (bps > fees.maxArrangementBps) throw new RequestError(`Arrangement fee is above the cap of ${fees.maxArrangementBps / 100}%`, 422);
}

/** Issuer-only, Draft-only (ADR 0013). */
export async function setArrangementFee(ctx: OpsContext, poolId: bigint, bps: number): Promise<string> {
  const account = await ctx.loadPool(poolId);
  if (poolStatusFromAnchor(account.status) !== "Draft") throw new RequestError("The arrangement fee can only change while the pool is Draft", 409);
  await assertArrangementFee(ctx, bps);
  return ctx.send("issuer", [await setArrangementFeeIx(ctx.program, { issuer: ctx.roles.issuer, pool: poolKey(ctx, poolId), bps })]);
}

export async function addProject(ctx: OpsContext, poolId: bigint, project: PublicKey): Promise<string> {
  return ctx.send("issuer", [await addProjectIx(ctx.program, { issuer: ctx.roles.issuer, pool: poolKey(ctx, poolId), project })]);
}

export async function openPool(ctx: OpsContext, poolId: bigint): Promise<string> {
  return ctx.send("issuer", [await openPoolIx(ctx.program, { issuer: ctx.roles.issuer, pool: poolKey(ctx, poolId) })]);
}

export async function closeSubscription(ctx: OpsContext, poolId: bigint): Promise<string> {
  return ctx.send("issuer", [await closeSubscriptionIx(ctx.program, { caller: ctx.roles.issuer, pool: poolKey(ctx, poolId) })]);
}

export async function disburseAll(ctx: OpsContext, poolId: bigint): Promise<string[]> {
  const pool = poolKey(ctx, poolId);
  const account = await ctx.loadPool(poolId);
  const fees = await ctx.loadFees();
  const treasury = fees ? new PublicKey(fees.treasury) : null;
  const signatures: string[] = [];
  for (const p of await ctx.loadProjects(pool)) {
    if (p.account.disbursed) continue;
    const ix = await disburseIx(ctx.program, {
      issuer: ctx.roles.issuer,
      pool,
      project: p.address,
      producer: p.account.producer,
      usdcMint: ctx.usdcMint,
      vault: account.vault,
      treasury,
    });
    signatures.push(await ctx.send("issuer", [ix]));
  }
  return signatures;
}

export async function recordSettlement(ctx: OpsContext, poolId: bigint, project: PublicKey, rule: SettlementRuleName): Promise<string> {
  return ctx.send("issuer", [await recordSettlementIx(ctx.program, { issuer: ctx.roles.issuer, pool: poolKey(ctx, poolId), project, rule })]);
}

/**
 * Deposits principal plus fixed yield. On devnet the deployer (test-USDC mint authority) first mints any
 * shortfall to the Issuer: a demo convenience that stands in for the Issuer's real repayment.
 * After maturity a deposit of 0 re-checks the redemption gate.
 */
export async function fundRedemption(ctx: OpsContext, poolId: bigint) {
  const pool = poolKey(ctx, poolId);
  const account = await ctx.loadPool(poolId);
  const required = withYield(BigInt(account.raisedAmount.toString()), account.yieldBps);
  const inVault = await ctx.tokenBalance(account.vault);
  const deficit = required > inVault ? required - inVault : 0n;
  const signatures: string[] = [];
  if (deficit > 0n) {
    const issuerUsdc = usdcAta(ctx.usdcMint, ctx.roles.issuer);
    const have = await ctx.tokenBalance(issuerUsdc);
    if (have < deficit) {
      signatures.push(
        await ctx.send("deployer", [
          createUsdcAtaIx(ctx.roles.deployer, ctx.roles.issuer, ctx.usdcMint),
          mintUsdcIx(ctx.usdcMint, issuerUsdc, ctx.roles.deployer, deficit - have),
        ]),
      );
    }
  }
  signatures.push(
    await ctx.send("issuer", [
      await fundRedemptionIx(ctx.program, { issuer: ctx.roles.issuer, pool, usdcMint: ctx.usdcMint, vault: account.vault, amount: deficit }),
    ]),
  );
  return { signatures, deposited: deficit, required, maturityPassed: ctx.now() >= account.maturityTs.toNumber() };
}

export async function sweep(ctx: OpsContext, poolId: bigint): Promise<string> {
  const account = await ctx.loadPool(poolId);
  return ctx.send("issuer", [
    await sweepIx(ctx.program, { issuer: ctx.roles.issuer, pool: poolKey(ctx, poolId), mint: account.mint, usdcMint: ctx.usdcMint, vault: account.vault }),
  ]);
}

/** Platform-level KYC (ADR 0011): sets the wallet's InvestorRecord to approved; subscribe thaws per pool. */
export async function approveInvestor(ctx: OpsContext, wallet: PublicKey): Promise<string> {
  return ctx.send("compliance", [await approveInvestorIx(ctx.program, { compliance: ctx.roles.compliance, investor: wallet })]);
}

/** Clears approval and freezes the investor's account in this pool if they ever subscribed to it. */
export async function revokeInvestor(ctx: OpsContext, poolId: bigint, wallet: PublicKey): Promise<string> {
  const account = await ctx.loadPool(poolId);
  const hasInstrumentAccount = await ctx.accountExists(instrumentAta(account.mint, wallet));
  return ctx.send("compliance", [
    await revokeInvestorIx(ctx.program, { compliance: ctx.roles.compliance, pool: poolKey(ctx, poolId), mint: account.mint, investor: wallet, hasInstrumentAccount }),
  ]);
}

export function nextPoolId(existing: string[]): string {
  return (existing.reduce((m, id) => (BigInt(id) > m ? BigInt(id) : m), 0n) + 1n).toString();
}

const ROLE_LABEL = { issuer: "Issuer", compliance: "Compliance", scas: "SCAS" } as const;

export function roleMismatches(config: ConfigView, keys: Partial<Record<"issuer" | "compliance" | "scas", string>>): string[] {
  return (Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[])
    .filter((r) => keys[r] !== undefined && keys[r] !== config[r])
    .map((r) => `${ROLE_LABEL[r]} key in this deployment is ${keys[r]}, but Config.${r} on devnet is ${config[r]}`);
}
