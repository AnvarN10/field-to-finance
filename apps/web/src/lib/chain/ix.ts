import type { Program } from "@anchor-lang/core";
import {
  attestationPda,
  configPda,
  feesPda,
  fieldPda,
  investorPda,
  mintPda,
  poolPda,
  projectPda,
  termsPda,
  toAnchorEnum,
  type AttestationKindName,
  type F2f,
  type VerdictName,
} from "@f2f/sdk";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { SystemProgram, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import type { SettlementRuleName } from "./enums";

type P = Program<F2f>;
const bn = (v: bigint | number) => new BN(v.toString());
// Anchor's generated enum types are unions of object literals; the runtime shape is { variant: {} }.
const anchorEnum = (name: string) => toAnchorEnum(name) as never;
const system = SystemProgram.programId;

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new RangeError("expected 64 lowercase hex characters");
  return Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)));
}

export const instrumentAta = (mint: PublicKey, owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
export const usdcAta = (usdcMint: PublicKey, owner: PublicKey, allowOffCurve = false) =>
  getAssociatedTokenAddressSync(usdcMint, owner, allowOffCurve, TOKEN_PROGRAM_ID);

export const createInstrumentAtaIx = (payer: PublicKey, owner: PublicKey, mint: PublicKey) =>
  createAssociatedTokenAccountIdempotentInstruction(payer, instrumentAta(mint, owner), owner, mint, TOKEN_2022_PROGRAM_ID);
export const createUsdcAtaIx = (payer: PublicKey, owner: PublicKey, usdcMint: PublicKey) =>
  createAssociatedTokenAccountIdempotentInstruction(payer, usdcAta(usdcMint, owner), owner, usdcMint, TOKEN_PROGRAM_ID);
export const mintUsdcIx = (usdcMint: PublicKey, destination: PublicKey, authority: PublicKey, amount: bigint) =>
  createMintToInstruction(usdcMint, destination, authority, amount, [], TOKEN_PROGRAM_ID);

/** Fee accounts for an instruction: present only when the program's FeeConfig exists. */
export interface FeeAccounts {
  usdcMint: PublicKey;
  /** FeeConfig.treasury wallet; fees go to its USDC ATA. */
  treasury: PublicKey;
}

/** `payer` pays rent for the project account (the gas sponsor); `fees` adds the mint-fee accounts. */
export function registerProjectIx(
  p: P,
  a: {
    producer: PublicKey;
    payer: PublicKey;
    projectId: bigint;
    crop: string;
    season: number;
    expectedKg: bigint;
    requestedAmount: bigint;
    fees: FeeAccounts | null;
  },
): Promise<TransactionInstruction> {
  return p.methods
    .registerProject(bn(a.projectId), a.crop, a.season, bn(a.expectedKg), bn(a.requestedAmount))
    .accountsStrict({
      producer: a.producer,
      payer: a.payer,
      config: configPda(p.programId),
      project: projectPda(p.programId, a.producer, a.projectId),
      feeConfig: feesPda(p.programId),
      usdcMint: a.fees?.usdcMint ?? null,
      producerUsdc: a.fees ? usdcAta(a.fees.usdcMint, a.producer) : null,
      treasuryUsdc: a.fees ? usdcAta(a.fees.usdcMint, a.fees.treasury) : null,
      usdcTokenProgram: a.fees ? TOKEN_PROGRAM_ID : null,
      systemProgram: system,
    })
    .instruction();
}

export function registerFieldIx(
  p: P,
  a: { producer: PublicKey; payer: PublicKey; project: PublicKey; index: number; polygonHash: string; areaHaX100: number },
): Promise<TransactionInstruction> {
  return p.methods
    .registerField(Array.from(hexToBytes(a.polygonHash)), a.areaHaX100)
    .accountsStrict({
      producer: a.producer,
      payer: a.payer,
      project: a.project,
      field: fieldPda(p.programId, a.project, a.index),
      systemProgram: system,
    })
    .instruction();
}

export function recordAttestationIx(
  p: P,
  a: {
    scas: PublicKey;
    project: PublicKey;
    field: PublicKey;
    sequence: number;
    kind: AttestationKindName;
    verdict: VerdictName;
    evidenceHash: Uint8Array;
    evidenceUri: string;
    ndviMeanX10k: number;
    sceneDate: number;
  },
): Promise<TransactionInstruction> {
  return p.methods
    .recordAttestation(anchorEnum(a.kind), anchorEnum(a.verdict), Array.from(a.evidenceHash), a.evidenceUri, a.ndviMeanX10k, bn(a.sceneDate))
    .accountsStrict({
      scas: a.scas,
      config: configPda(p.programId),
      project: a.project,
      field: a.field,
      attestation: attestationPda(p.programId, a.field, a.sequence),
      systemProgram: system,
    })
    .instruction();
}

export function createPoolIx(
  p: P,
  a: {
    issuer: PublicKey;
    usdcMint: PublicKey;
    poolId: bigint;
    crop: string;
    season: number;
    name: string;
    symbol: string;
    uri: string;
    yieldBps: number;
    premiumBps: number;
    subscriptionCloseTs: number;
    maturityTs: number;
  },
): Promise<TransactionInstruction> {
  const pool = poolPda(p.programId, a.poolId);
  return p.methods
    .createPool(bn(a.poolId), {
      crop: a.crop,
      season: a.season,
      name: a.name,
      symbol: a.symbol,
      uri: a.uri,
      yieldBps: a.yieldBps,
      premiumBps: a.premiumBps,
      subscriptionCloseTs: bn(a.subscriptionCloseTs),
      maturityTs: bn(a.maturityTs),
    })
    .accountsStrict({
      issuer: a.issuer,
      config: configPda(p.programId),
      pool,
      mint: mintPda(p.programId, pool),
      usdcMint: a.usdcMint,
      vault: usdcAta(a.usdcMint, pool, true),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      usdcTokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: system,
    })
    .instruction();
}

export const addProjectIx = (p: P, a: { issuer: PublicKey; pool: PublicKey; project: PublicKey }) =>
  p.methods.addProject().accountsStrict({ issuer: a.issuer, config: configPda(p.programId), pool: a.pool, project: a.project }).instruction();

/** Issuer-only, Draft-only: the pool's arrangement fee, withheld from each project at disbursement. */
export const setArrangementFeeIx = (p: P, a: { issuer: PublicKey; pool: PublicKey; bps: number }) =>
  p.methods
    .setArrangementFee(a.bps)
    .accountsStrict({
      issuer: a.issuer,
      config: configPda(p.programId),
      pool: a.pool,
      feeConfig: feesPda(p.programId),
      poolTerms: termsPda(p.programId, a.pool),
      systemProgram: system,
    })
    .instruction();

export const openPoolIx = (p: P, a: { issuer: PublicKey; pool: PublicKey }) =>
  p.methods.openPool().accountsStrict({ issuer: a.issuer, config: configPda(p.programId), pool: a.pool }).instruction();

export const closeSubscriptionIx = (p: P, a: { caller: PublicKey; pool: PublicKey }) =>
  p.methods.closeSubscription().accountsStrict({ caller: a.caller, pool: a.pool }).instruction();

/** Platform-level KYC (ADR 0011): one approval per wallet covers every pool. No pool, mint or token account. */
export const approveInvestorIx = (p: P, a: { compliance: PublicKey; investor: PublicKey }) =>
  p.methods
    .approveInvestor()
    .accountsStrict({
      compliance: a.compliance,
      config: configPda(p.programId),
      investor: a.investor,
      investorRecord: investorPda(p.programId, a.investor),
      systemProgram: system,
    })
    .instruction();

/** Clears approval; freezes this pool's Instrument account only if it exists (`investor_instrument` is optional). */
export const revokeInvestorIx = (
  p: P,
  a: { compliance: PublicKey; pool: PublicKey; mint: PublicKey; investor: PublicKey; hasInstrumentAccount: boolean },
) =>
  p.methods
    .revokeInvestor()
    .accountsStrict({
      compliance: a.compliance,
      config: configPda(p.programId),
      pool: a.pool,
      mint: a.mint,
      investor: a.investor,
      investorRecord: investorPda(p.programId, a.investor),
      investorInstrument: a.hasInstrumentAccount ? instrumentAta(a.mint, a.investor) : null,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();

type HolderArgs = { investor: PublicKey; pool: PublicKey; mint: PublicKey; vault: PublicKey; usdcMint: PublicKey; amount: bigint };

/**
 * ADR 0011: subscribe creates the investor's Instrument account (init_if_needed) and thaws it when the record is approved.
 * ADR 0013: `payer` (the gas sponsor) pays that rent; with `treasury` set the network fee goes to its USDC ATA.
 */
export const subscribeIx = (p: P, a: HolderArgs & { payer: PublicKey; treasury: PublicKey | null }) =>
  p.methods
    .subscribe(bn(a.amount))
    .accountsStrict({
      investor: a.investor,
      payer: a.payer,
      pool: a.pool,
      investorRecord: investorPda(p.programId, a.investor),
      mint: a.mint,
      investorInstrument: instrumentAta(a.mint, a.investor),
      usdcMint: a.usdcMint,
      investorUsdc: usdcAta(a.usdcMint, a.investor),
      vault: a.vault,
      feeConfig: feesPda(p.programId),
      treasuryUsdc: a.treasury ? usdcAta(a.usdcMint, a.treasury) : null,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      usdcTokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: system,
    })
    .instruction();

const holderAccounts = (a: HolderArgs) => ({
  investor: a.investor,
  pool: a.pool,
  mint: a.mint,
  investorInstrument: instrumentAta(a.mint, a.investor),
  usdcMint: a.usdcMint,
  investorUsdc: usdcAta(a.usdcMint, a.investor),
  vault: a.vault,
  tokenProgram: TOKEN_2022_PROGRAM_ID,
  usdcTokenProgram: TOKEN_PROGRAM_ID,
});

export const refundIx = (p: P, a: HolderArgs) => p.methods.refund(bn(a.amount)).accountsStrict(holderAccounts(a)).instruction();
export const redeemIx = (p: P, a: HolderArgs) => p.methods.redeem(bn(a.amount)).accountsStrict(holderAccounts(a)).instruction();

/** ADR 0013: withholds the pool's arrangement fee (PoolTerms) for the treasury; `treasury` is FeeConfig.treasury or null. */
export const disburseIx = (
  p: P,
  a: { issuer: PublicKey; pool: PublicKey; project: PublicKey; producer: PublicKey; usdcMint: PublicKey; vault: PublicKey; treasury: PublicKey | null },
) =>
  p.methods
    .disburse()
    .accountsStrict({
      issuer: a.issuer,
      config: configPda(p.programId),
      pool: a.pool,
      project: a.project,
      producer: a.producer,
      usdcMint: a.usdcMint,
      vault: a.vault,
      producerUsdc: usdcAta(a.usdcMint, a.producer),
      poolTerms: termsPda(p.programId, a.pool),
      feeConfig: feesPda(p.programId),
      treasuryUsdc: a.treasury ? usdcAta(a.usdcMint, a.treasury) : null,
      usdcTokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: system,
    })
    .instruction();

export const recordSettlementIx = (p: P, a: { issuer: PublicKey; pool: PublicKey; project: PublicKey; rule: SettlementRuleName }) =>
  p.methods
    .recordSettlement(anchorEnum(a.rule))
    .accountsStrict({ issuer: a.issuer, config: configPda(p.programId), pool: a.pool, project: a.project })
    .instruction();

export const fundRedemptionIx = (p: P, a: { issuer: PublicKey; pool: PublicKey; usdcMint: PublicKey; vault: PublicKey; amount: bigint }) =>
  p.methods
    .fundRedemption(bn(a.amount))
    .accountsStrict({
      issuer: a.issuer,
      config: configPda(p.programId),
      pool: a.pool,
      usdcMint: a.usdcMint,
      issuerUsdc: usdcAta(a.usdcMint, a.issuer),
      vault: a.vault,
      usdcTokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

export const sweepIx = (p: P, a: { issuer: PublicKey; pool: PublicKey; mint: PublicKey; usdcMint: PublicKey; vault: PublicKey }) =>
  p.methods
    .sweep()
    .accountsStrict({
      issuer: a.issuer,
      config: configPda(p.programId),
      pool: a.pool,
      mint: a.mint,
      usdcMint: a.usdcMint,
      vault: a.vault,
      issuerUsdc: usdcAta(a.usdcMint, a.issuer),
      usdcTokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
