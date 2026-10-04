import type { Program } from "@anchor-lang/core";
import {
  MAX_ARRANGEMENT_BPS,
  MAX_COUPON_BPS,
  MAX_EVIDENCE_URI_LEN,
  MAX_SHORT_STR_LEN,
  MAX_TOKENIZED_SHARE_BPS,
  SETTLEMENT_MODES,
  effectiveElection,
  electionFromAnchor,
  fieldPda,
  instrumentPda,
  investorPda,
  poolPda,
  redemptionDue,
  settlementModeFromAnchor,
  type F2f,
  type SettlementElectionName,
  type VerdictName,
} from "@f2f/sdk";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { z } from "zod";
import { RequestError } from "../errors";
import { poolStatusFromAnchor, type SettlementRuleName } from "./enums";
import {
  addProjectIx,
  approveInvestorIx,
  closeSubscriptionIx,
  createPoolIx,
  createUsdcAtaIx,
  disburseIx,
  electSettlementIx,
  fundRedemptionIx,
  hexToBytes,
  instrumentAta,
  mintUsdcIx,
  openPoolIx,
  recordDeliveryIx,
  recordSettlementIx,
  revokeInvestorIx,
  setArrangementFeeIx,
  setInstrumentTermsIx,
  sweepIx,
  usdcAta,
} from "./ix";
import type { ConfigView, FeeView, FieldAccount, InstrumentTermsAccount, PoolAccount, ProjectAccount } from "./views";

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
  /** InstrumentTerms of a pool (ADR 0014), or null. */
  loadTerms(pool: PublicKey): Promise<InstrumentTermsAccount | null>;
  loadField(address: PublicKey): Promise<FieldAccount>;
  /** Whether the wallet's InvestorRecord is approved (platform KYC). */
  isKycApproved(wallet: PublicKey): Promise<boolean>;
  now(): number;
}

/** The OpsContext reads every caller builds the same way from a Program. */
export function programReads(program: Program<F2f>): Pick<OpsContext, "loadTerms" | "loadField" | "isKycApproved"> {
  return {
    loadTerms: (pool) => program.account.instrumentTerms.fetchNullable(instrumentPda(program.programId, pool)),
    loadField: (address) => program.account.field.fetch(address),
    isKycApproved: async (wallet) => (await program.account.investorRecord.fetchNullable(investorPda(program.programId, wallet)))?.approved ?? false,
  };
}

const pubkey = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "must be a base58 public key");

/** Term-sheet terms (ADR 0014). Amounts in whole USD and tonnes; converted to base units and kg on-chain. */
export const instrumentInput = z.object({
  issuerOfRecord: pubkey,
  unitNominalUsd: z.number().int().min(1, "nominal must be above zero").max(100_000_000),
  couponBps: z.number().int().min(0).max(MAX_COUPON_BPS, `coupon must be at most ${MAX_COUPON_BPS / 100}%`),
  settlementMode: z.enum(SETTLEMENT_MODES),
  volumeTonnes: z.number().int().min(1).max(10_000_000),
  tokenizedShareBps: z.number().int().min(1).max(MAX_TOKENIZED_SHARE_BPS, `tokenized share must be at most ${MAX_TOKENIZED_SHARE_BPS / 100}%`),
  elevator: z.string().trim().min(1).max(MAX_SHORT_STR_LEN),
  lab: z.string().trim().min(1).max(MAX_SHORT_STR_LEN),
  /** Demo only: start interest this many days before maturity instead of at subscription close. */
  interestDays: z.number().int().min(1).max(1_830).optional(),
});
export type InstrumentInput = z.infer<typeof instrumentInput>;

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
    instrument: instrumentInput.optional(),
  })
  .refine((v) => v.maturityInMinutes > v.closeInMinutes, { message: "maturity must be after subscription close", path: ["maturityInMinutes"] });
export type CreatePoolInput = z.infer<typeof createPoolInput>;

const poolKey = (ctx: OpsContext, poolId: bigint) => poolPda(ctx.program.programId, poolId);

/** Quality spec JSON already stored in the bucket: its SHA-256 and public URI. */
export interface StoredSpec {
  hash: string;
  uri: string;
}

export async function createPool(ctx: OpsContext, input: CreatePoolInput, publicBaseUrl: string, spec?: StoredSpec) {
  const poolId = BigInt(input.poolId);
  const uri = `${publicBaseUrl.replace(/\/+$/, "")}/api/instrument/${input.poolId}`;
  if (uri.length > MAX_EVIDENCE_URI_LEN) throw new RequestError("Instrument URI is too long; shorten PUBLIC_BASE_URL", 422);
  await assertArrangementFee(ctx, input.arrangementFeeBps);
  if (input.instrument) {
    if (!spec) throw new RequestError("A pilot pool needs its quality spec stored first", 422);
    if (spec.uri.length > MAX_EVIDENCE_URI_LEN) throw new RequestError("Quality spec URI is too long; shorten PUBLIC_BASE_URL", 422);
    if (!(await ctx.isKycApproved(new PublicKey(input.instrument.issuerOfRecord)))) {
      throw new RequestError("The issuer of record has not passed KYC. Approve the farmer first.", 422);
    }
  }
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
  if (input.instrument && spec) {
    const i = input.instrument;
    const close = now + input.closeInMinutes * 60;
    const maturity = now + input.maturityInMinutes * 60;
    // Interest accrues from subscription close, when every investor's money is in (ADR 0014).
    const startTs = i.interestDays ? maturity - i.interestDays * 86_400 : close;
    ixs.push(
      await setInstrumentTermsIx(ctx.program, {
        arranger: ctx.roles.issuer,
        pool: poolKey(ctx, poolId),
        issuerOfRecord: new PublicKey(i.issuerOfRecord),
        terms: {
          unitNominal: BigInt(i.unitNominalUsd) * 1_000_000n,
          couponBpsAnnual: i.couponBps,
          startTs,
          settlementMode: i.settlementMode,
          volumeKg: BigInt(i.volumeTonnes) * 1_000n,
          tokenizedShareBps: i.tokenizedShareBps,
          qualitySpecHash: spec.hash,
          specUri: spec.uri,
          elevator: i.elevator,
          lab: i.lab,
        },
      }),
    );
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
  const termsAccount = await ctx.loadTerms(pool);
  const maturityTs = account.maturityTs.toNumber();
  const terms = termsAccount
    ? {
        couponBpsAnnual: termsAccount.couponBpsAnnual,
        startTs: termsAccount.startTs.toNumber(),
        settlementMode: settlementModeFromAnchor(termsAccount.settlementMode),
        election: termsAccount.election ? electionFromAnchor(termsAccount.election) : null,
      }
    : null;
  const election = terms ? effectiveElection(terms, ctx.now(), maturityTs) : null;
  if (terms && election === "Delivery") throw new RequestError("Grain delivery applies to this pool; cash redemption is closed.", 409);
  // The program accepts cash only on the buyback path (review I1): elect buyback first.
  if (terms && election === null) throw new RequestError("Elect buyback first: cash is accepted only on the buyback path.", 409);
  const required = redemptionDue(BigInt(account.raisedAmount.toString()), { yieldBps: account.yieldBps, maturityTs }, terms);
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

/** Admin-only test-USDC mint for demo investors buying $100,000 tokens; the public faucet stays small. */
export const ADMIN_MINT_MAX_USD = 5_000_000;

export async function adminMintUsdc(ctx: OpsContext, wallet: PublicKey, usd: number): Promise<string> {
  if (!Number.isInteger(usd) || usd < 1 || usd > ADMIN_MINT_MAX_USD) {
    throw new RequestError(`Mint between $1 and $${ADMIN_MINT_MAX_USD.toLocaleString("en-US")} of test USDC`, 422);
  }
  return ctx.send("deployer", [
    createUsdcAtaIx(ctx.roles.deployer, wallet, ctx.usdcMint),
    mintUsdcIx(ctx.usdcMint, usdcAta(ctx.usdcMint, wallet), ctx.roles.deployer, BigInt(usd) * 1_000_000n),
  ]);
}

/** Hybrid pools: the arranger records the issuer's election (ADR 0014). */
export async function electSettlement(ctx: OpsContext, poolId: bigint, election: SettlementElectionName): Promise<string> {
  return ctx.send("issuer", [await electSettlementIx(ctx.program, { signer: ctx.roles.issuer, pool: poolKey(ctx, poolId), election })]);
}

export interface DeliveryRecordInput {
  kind: "ElevatorReceipt" | "LabQuality";
  verdict: VerdictName;
  /** SHA-256 of the evidence JSON stored in the bucket. */
  evidenceHash: string;
  evidenceUri: string;
}

/** Elevator receipt or lab certificate, recorded by the arranger on field 0 of the pool's first project. */
export async function recordDelivery(ctx: OpsContext, poolId: bigint, input: DeliveryRecordInput): Promise<string> {
  const pool = poolKey(ctx, poolId);
  const [project] = await ctx.loadProjects(pool);
  if (!project) throw new RequestError("The pool has no projects", 409);
  const field = fieldPda(ctx.program.programId, project.address, 0);
  const { attestationCount } = await ctx.loadField(field);
  return ctx.send("issuer", [
    await recordDeliveryIx(ctx.program, {
      signer: ctx.roles.issuer,
      pool,
      project: project.address,
      field,
      sequence: attestationCount,
      kind: input.kind,
      verdict: input.verdict,
      evidenceHash: hexToBytes(input.evidenceHash),
      evidenceUri: input.evidenceUri,
    }),
  ]);
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
