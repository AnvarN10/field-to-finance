import { attestationPda, feesPda, fieldPda, instrumentPda, investorPda, mintPda, poolPda, projectPda, termsPda } from "@f2f/sdk";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, type TransactionInstruction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
  approveInvestorIx,
  createInstrumentAtaIx,
  createPoolIx,
  disburseIx,
  electSettlementIx,
  fundRedemptionIx,
  hexToBytes,
  openPoolIx,
  recordDeliveryIx,
  redeemDeliveryIx,
  redeemIx,
  setInstrumentTermsIx,
  recordAttestationIx,
  recordSettlementIx,
  registerFieldIx,
  registerProjectIx,
  revokeInvestorIx,
  setArrangementFeeIx,
  subscribeIx,
} from "../src/lib/chain/ix";
import { offlineProgram } from "./fixtures/accounts";

const program = offlineProgram();
const pid = program.programId;
const k = () => Keypair.generate().publicKey;
const norm = (s: string) => s.replace(/_/g, "").toLowerCase();

function decode(ix: TransactionInstruction) {
  // The runtime coder is BorshInstructionCoder; the InstructionCoder interface omits decode.
  const coder = program.coder.instruction as unknown as { decode(data: Buffer): { name: string; data: unknown } | null };
  const d = coder.decode(ix.data);
  if (!d) throw new Error("not an f2f instruction");
  return { name: norm(d.name), data: d.data as Record<string, unknown> };
}

describe("instruction builders", () => {
  it("registers a project at its PDA", async () => {
    const producer = k();
    const payer = k();
    const ix = await registerProjectIx(program, { producer, payer, projectId: 42n, crop: "wheat", season: 2027, expectedKg: 400_000n, requestedAmount: 2_000_000_000n, fees: null });
    expect(ix.programId.equals(pid)).toBe(true);
    expect(ix.keys[3]?.pubkey.equals(projectPda(pid, producer, 42n))).toBe(true);
    // The sponsor pays rent; the producer only signs.
    expect(ix.keys[1]).toMatchObject({ pubkey: payer, isSigner: true, isWritable: true });
    expect(ix.keys[0]).toMatchObject({ pubkey: producer, isSigner: true, isWritable: false });
    const d = decode(ix);
    expect(d.name).toBe("registerproject");
    expect(String(d.data.requestedAmount ?? d.data.requested_amount)).toBe("2000000000");
  });

  it("registers a field with the polygon hash bytes", async () => {
    const producer = k();
    const project = k();
    const hash = "ab".repeat(32);
    const ix = await registerFieldIx(program, { producer, payer: k(), project, index: 1, polygonHash: hash, areaHaX100: 7611 });
    expect(ix.keys[3]?.pubkey.equals(fieldPda(pid, project, 1))).toBe(true);
    expect(Buffer.from(ix.data).includes(Buffer.from(hash, "hex"))).toBe(true);
  });

  it("rejects a malformed polygon hash", () => {
    expect(() => hexToBytes("xyz")).toThrow(RangeError);
    expect(() => hexToBytes("ab".repeat(31))).toThrow(RangeError);
  });

  it("records an attestation at attestation_count", async () => {
    const field = k();
    const ix = await recordAttestationIx(program, {
      scas: k(),
      project: k(),
      field,
      sequence: 3,
      kind: "Harvest",
      verdict: "Pass",
      evidenceHash: new Uint8Array(32).fill(1),
      evidenceUri: "https://f2f.example/api/evidence/" + "01".repeat(32),
      ndviMeanX10k: 0,
      sceneDate: 1_791_000_000,
    });
    expect(ix.keys.some((m) => m.pubkey.equals(attestationPda(pid, field, 3)))).toBe(true);
    const d = decode(ix);
    expect(Object.keys(d.data.kind as object)[0]).toBe("harvest");
  });

  it("creates a pool with its mint PDA and the pool's USDC vault", async () => {
    const usdcMint = k();
    const ix = await createPoolIx(program, {
      issuer: k(),
      usdcMint,
      poolId: 7n,
      crop: "wheat",
      season: 2027,
      name: "Wheat 2027",
      symbol: "WHEAT-2027",
      uri: "https://f2f.example/api/instrument/7",
      yieldBps: 800,
      premiumBps: 550,
      subscriptionCloseTs: 1_791_000_600,
      maturityTs: 1_791_001_200,
    });
    const pool = poolPda(pid, 7n);
    const keys = ix.keys.map((m) => m.pubkey.toBase58());
    expect(keys).toContain(pool.toBase58());
    expect(keys).toContain(mintPda(pid, pool).toBase58());
    expect(keys).toContain(getAssociatedTokenAddressSync(usdcMint, pool, true, TOKEN_PROGRAM_ID).toBase58());
    expect(keys).toContain(TOKEN_2022_PROGRAM_ID.toBase58());
  });

  it("subscribes with the investor record PDA, the Token-2022 instrument account and the programs to create it", async () => {
    const investor = k();
    const mint = k();
    const payer = k();
    const ix = await subscribeIx(program, { investor, payer, pool: k(), mint, vault: k(), usdcMint: k(), amount: 250_000_000n, treasury: null });
    const keys = ix.keys.map((m) => m.pubkey.toBase58());
    expect(keys).toContain(investorPda(pid, investor).toBase58());
    expect(keys).toContain(getAssociatedTokenAddressSync(mint, investor, false, TOKEN_2022_PROGRAM_ID).toBase58());
    expect(keys).toContain(ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());
    expect(keys).toContain(feesPda(pid).toBase58());
    // The sponsor pays rent for the instrument account; the investor only signs.
    expect(ix.keys[1]).toMatchObject({ pubkey: payer, isSigner: true, isWritable: true });
    expect(ix.keys[0]?.isWritable).toBe(false);
    expect(String(decode(ix).data.amount)).toBe("250000000");
  });

  it("passes the treasury USDC account when fees are configured", async () => {
    const usdcMint = k();
    const treasury = k();
    const ix = await subscribeIx(program, { investor: k(), payer: k(), pool: k(), mint: k(), vault: k(), usdcMint, amount: 1n, treasury });
    const ata = getAssociatedTokenAddressSync(usdcMint, treasury, false, TOKEN_PROGRAM_ID);
    expect(ix.keys.some((m) => m.pubkey.equals(ata) && m.isWritable)).toBe(true);
  });

  it("register_project with fees passes the producer's USDC account for the mint fee", async () => {
    const producer = k();
    const usdcMint = k();
    const treasury = k();
    const ix = await registerProjectIx(program, { producer, payer: k(), projectId: 1n, crop: "wheat", season: 2027, expectedKg: 1n, requestedAmount: 1n, fees: { usdcMint, treasury } });
    const keys = ix.keys.map((m) => m.pubkey.toBase58());
    expect(keys).toContain(getAssociatedTokenAddressSync(usdcMint, producer, false, TOKEN_PROGRAM_ID).toBase58());
    expect(keys).toContain(getAssociatedTokenAddressSync(usdcMint, treasury, false, TOKEN_PROGRAM_ID).toBase58());
  });

  it("accepts an off-curve (PDA) treasury", async () => {
    const pdaTreasury = poolPda(pid, 99n);
    await expect(subscribeIx(program, { investor: k(), payer: k(), pool: k(), mint: k(), vault: k(), usdcMint: k(), amount: 1n, treasury: pdaTreasury })).resolves.toBeTruthy();
  });

  it("disburses with the pool's terms PDA and the treasury account", async () => {
    const pool = k();
    const usdcMint = k();
    const treasury = k();
    const ix = await disburseIx(program, { issuer: k(), pool, project: k(), producer: k(), usdcMint, vault: k(), treasury });
    const keys = ix.keys.map((m) => m.pubkey.toBase58());
    expect(keys).toContain(termsPda(pid, pool).toBase58());
    expect(keys).toContain(getAssociatedTokenAddressSync(usdcMint, treasury, false, TOKEN_PROGRAM_ID).toBase58());
  });

  it("sets a pool's arrangement fee at its terms PDA", async () => {
    const pool = k();
    const ix = await setArrangementFeeIx(program, { issuer: k(), pool, bps: 200 });
    expect(ix.keys.some((m) => m.pubkey.equals(termsPda(pid, pool)))).toBe(true);
    expect(decode(ix)).toMatchObject({ name: "setarrangementfee", data: { bps: 200 } });
  });

  it("approves an investor platform-wide with only the record accounts", async () => {
    const investor = k();
    const ix = await approveInvestorIx(program, { compliance: k(), investor });
    expect(ix.keys).toHaveLength(5);
    expect(ix.keys.some((m) => m.pubkey.equals(investorPda(pid, investor)))).toBe(true);
  });

  it("revokes without an instrument account when the investor never subscribed", async () => {
    const investor = k();
    const mint = k();
    const without = await revokeInvestorIx(program, { compliance: k(), pool: k(), mint, investor, hasInstrumentAccount: false });
    const ata = getAssociatedTokenAddressSync(mint, investor, false, TOKEN_2022_PROGRAM_ID);
    expect(without.keys.some((m) => m.pubkey.equals(ata))).toBe(false);
    const withAta = await revokeInvestorIx(program, { compliance: k(), pool: k(), mint, investor, hasInstrumentAccount: true });
    expect(withAta.keys.some((m) => m.pubkey.equals(ata))).toBe(true);
  });

  it("encodes the settlement rule", async () => {
    const ix = await recordSettlementIx(program, { issuer: k(), pool: k(), project: k(), rule: "CoveredFromOtherFields" });
    expect(Object.keys(decode(ix).data.rule as object)[0]).toBe("coveredFromOtherFields");
  });

  it("creates the instrument ATA idempotently under Token-2022", () => {
    const ix = createInstrumentAtaIx(k(), k(), k());
    expect(ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
    expect(ix.keys.some((m) => m.pubkey.equals(TOKEN_2022_PROGRAM_ID))).toBe(true);
    expect(ix.data[0]).toBe(1); // CreateIdempotent
  });

  it("passes the pool's InstrumentTerms PDA to every instruction that reads it", async () => {
    const pool = k();
    const want = instrumentPda(pid, pool);
    const has = (ix: TransactionInstruction) => ix.keys.some((m) => m.pubkey.equals(want));
    const holder = { investor: k(), pool, mint: k(), vault: k(), usdcMint: k(), amount: 1n };
    expect(has(await subscribeIx(program, { ...holder, payer: k(), treasury: null }))).toBe(true);
    expect(has(await redeemIx(program, holder))).toBe(true);
    expect(has(await openPoolIx(program, { issuer: k(), pool }))).toBe(true);
    expect(has(await fundRedemptionIx(program, { issuer: k(), pool, usdcMint: k(), vault: k(), amount: 0n }))).toBe(true);
  });

  it("funds redemption from the signer's own USDC account, so the farmer issuer can fund the buyback", async () => {
    const issuer = k();
    const usdcMint = k();
    const ix = await fundRedemptionIx(program, { issuer, pool: k(), usdcMint, vault: k(), amount: 5n });
    expect(ix.keys.some((m) => m.pubkey.equals(getAssociatedTokenAddressSync(usdcMint, issuer, false, TOKEN_PROGRAM_ID)))).toBe(true);
  });

  it("sets instrument terms with the issuer of record's KYC record", async () => {
    const pool = k();
    const farmer = k();
    const ix = await setInstrumentTermsIx(program, {
      arranger: k(),
      pool,
      issuerOfRecord: farmer,
      terms: {
        unitNominal: 100_000_000_000n,
        couponBpsAnnual: 500,
        startTs: 1_800_000_000,
        settlementMode: "Hybrid",
        volumeKg: 10_000_000n,
        tokenizedShareBps: 3_000,
        qualitySpecHash: "ab".repeat(32),
        specUri: "https://x/api/evidence/" + "ab".repeat(32),
        elevator: "Ust-Kamenogorsk",
        lab: "Baltic Control",
      },
    });
    const keys = ix.keys.map((m) => m.pubkey.toBase58());
    expect(keys).toContain(investorPda(pid, farmer).toBase58());
    expect(keys).toContain(instrumentPda(pid, pool).toBase58());
    const d = decode(ix);
    expect(d.name).toBe("setinstrumentterms");
    const args = d.data.args as Record<string, unknown>;
    expect(String(args.unitNominal ?? args.unit_nominal)).toBe("100000000000");
    expect(Object.keys((args.settlementMode ?? args.settlement_mode) as object)[0]).toBe("hybrid");
    expect(Object.keys((args.dayCount ?? args.day_count) as object)[0]).toBe("act360");
  });

  it("elects settlement and records delivery attestations", async () => {
    const pool = k();
    const elect = await electSettlementIx(program, { signer: k(), pool, election: "Delivery" });
    expect(Object.keys(decode(elect).data.election as object)[0]).toBe("delivery");
    const field = k();
    const rec = await recordDeliveryIx(program, { signer: k(), pool, project: k(), field, sequence: 3, kind: "LabQuality", verdict: "Pass", evidenceHash: new Uint8Array(32).fill(1), evidenceUri: "https://x/e" });
    expect(rec.keys.some((m) => m.pubkey.equals(attestationPda(pid, field, 3)))).toBe(true);
    expect(Object.keys(decode(rec).data.kind as object)[0]).toBe("labQuality");
  });

  it("redeems for grain with the terms account and no USDC accounts", async () => {
    const pool = k();
    const mint = k();
    const investor = k();
    const ix = await redeemDeliveryIx(program, { investor, pool, mint, amount: 100_000_000_000n });
    expect(ix.keys).toHaveLength(6);
    expect(ix.keys.some((m) => m.pubkey.equals(instrumentPda(pid, pool)))).toBe(true);
    expect(ix.keys.some((m) => m.pubkey.equals(getAssociatedTokenAddressSync(mint, investor, false, TOKEN_2022_PROGRAM_ID)))).toBe(true);
  });
});
