import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { F2F_IDL, type F2f } from "@f2f/sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/** Never contacted: every builder uses accountsStrict and every read is stubbed. */
export const offlineConnection = new Connection("http://127.0.0.1:1", "confirmed");

export function offlineProgram(signer: Keypair = Keypair.generate()): Program<F2f> {
  return new Program<F2f>(F2F_IDL, new AnchorProvider(offlineConnection, new Wallet(signer), { commitment: "confirmed" }));
}

export type AccountName = "pool" | "farmProject" | "field" | "attestation" | "investorRecord" | "config" | "instrumentTerms";

/** Encodes with the real IDL and decodes back, so fixtures have exactly Anchor's runtime shape. */
export async function roundTrip<T>(program: Program<F2f>, name: AccountName, value: object): Promise<{ data: Buffer; account: T }> {
  const data = await program.coder.accounts.encode(name, value);
  return { data, account: program.coder.accounts.decode(name, data) as T };
}

export const key = () => Keypair.generate().publicKey;

export function poolValue(o: Partial<Record<string, unknown>> = {}) {
  return {
    poolId: new BN(7),
    issuer: key(),
    mint: key(),
    vault: key(),
    crop: "wheat",
    season: 2027,
    targetAmount: new BN(2_000_000_000),
    raisedAmount: new BN(500_000_000),
    yieldBps: 800,
    premiumBps: 550,
    subscriptionCloseTs: new BN(1_791_000_000),
    maturityTs: new BN(1_791_000_600),
    projectCount: 1,
    disbursedCount: 0,
    settledCount: 0,
    status: { open: {} },
    bump: 254,
    mintBump: 253,
    ...o,
  };
}

export function projectValue(o: Partial<Record<string, unknown>> = {}) {
  return {
    producer: key(),
    projectId: new BN(1_759_500_000_000),
    pool: null as PublicKey | null,
    crop: "wheat",
    season: 2027,
    expectedKg: new BN(400_000),
    tokenizedKg: new BN(120_000),
    requestedAmount: new BN(2_000_000_000),
    fieldCount: 2,
    verifiedFieldCount: 1,
    harvestAttested: false,
    disbursed: false,
    settlement: null as unknown,
    bump: 255,
    ...o,
  };
}

export function fieldValue(o: Partial<Record<string, unknown>> = {}) {
  return {
    project: key(),
    index: 0,
    polygonHash: Array.from({ length: 32 }, (_, i) => i),
    areaHaX100: 7611,
    verified: true,
    attestationCount: 1,
    bump: 252,
    ...o,
  };
}

export function attestationValue(o: Partial<Record<string, unknown>> = {}) {
  return {
    field: key(),
    project: key(),
    sequence: 0,
    kind: { fieldVerified: {} },
    verdict: { pass: {} },
    evidenceHash: Array.from({ length: 32 }, () => 0xab),
    evidenceUri: "https://f2f.example/api/evidence/" + "ab".repeat(32),
    ndviMeanX10k: 0,
    sceneDate: new BN(1_791_000_100),
    signer: key(),
    recordedAt: new BN(1_791_000_101),
    bump: 251,
    ...o,
  };
}

/** The runtime instruction coder is BorshInstructionCoder; Anchor's InstructionCoder type omits decode. */
export function ixCoder(program: Program<F2f>) {
  return program.coder.instruction as unknown as { decode(data: Buffer): { name: string; data: unknown } | null };
}

/** Pilot term sheet InstrumentTerms (ADR 0014). */
export function termsValue(o: Partial<Record<string, unknown>> = {}) {
  return {
    pool: key(),
    unitNominal: new BN("100000000000"),
    couponBpsAnnual: 500,
    dayCount: { act360: {} },
    startTs: new BN(1_791_000_000),
    settlementMode: { hybrid: {} },
    volumeKg: new BN(10_000_000),
    tokenizedShareBps: 3_000,
    qualitySpecHash: Array(32).fill(9),
    specUri: "https://f2f.example/api/evidence/spec",
    elevator: "Ust-Kamenogorsk",
    lab: "Baltic Control",
    election: null,
    electedAt: new BN(0),
    receiptHash: Array(32).fill(0),
    labCertHash: Array(32).fill(0),
    labPassed: false,
    deliveredKg: new BN(0),
    bump: 252,
    ...o,
  };
}
