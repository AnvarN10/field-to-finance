import { attestationPda, instrumentPda, investorPda, poolPda, termsPda } from "@f2f/sdk";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { describe, expect, it, vi } from "vitest";
import type { PoolAccount, ProjectAccount } from "../src/lib/chain/views";
import {
  ADMIN_MINT_MAX_USD,
  adminMintUsdc,
  approveInvestor,
  createPool,
  createPoolInput,
  disburseAll,
  electSettlement,
  fundRedemption,
  recordDelivery,
  nextPoolId,
  revokeInvestor,
  setArrangementFee,
  roleMismatches,
  type OpsContext,
} from "../src/lib/chain/admin-ops";
import { fieldValue, ixCoder, offlineProgram, poolValue, projectValue, roundTrip, termsValue } from "./fixtures/accounts";
import type { FieldAccount, InstrumentTermsAccount } from "../src/lib/chain/views";

const program = offlineProgram();
const norm = (s: string) => s.replace(/_/g, "").toLowerCase();
const names = (ixs: TransactionInstruction[]) =>
  ixs.map((ix) => (ix.programId.equals(program.programId) ? norm(ixCoder(program).decode(ix.data)!.name) : ix.programId.toBase58()));

const TREASURY = Keypair.generate().publicKey;
const FEES = { treasury: TREASURY.toBase58(), networkFee: "500000", mintFee: "3000000", maxArrangementBps: 1_000 };

async function ctx(
  over: {
    pool?: Record<string, unknown>;
    projects?: Record<string, unknown>[];
    balances?: Map<string, bigint>;
    fees?: typeof FEES | null;
    terms?: Record<string, unknown> | null;
    kyc?: boolean;
  } = {},
) {
  const sent: { role: string; ixs: TransactionInstruction[] }[] = [];
  const pool = (await roundTrip<PoolAccount>(program, "pool", poolValue(over.pool))).account;
  const projects = await Promise.all(
    (over.projects ?? [{}]).map(async (p) => ({
      address: Keypair.generate().publicKey,
      account: (await roundTrip<ProjectAccount>(program, "farmProject", projectValue(p))).account,
    })),
  );
  const c: OpsContext = {
    program,
    usdcMint: Keypair.generate().publicKey,
    roles: { issuer: Keypair.generate().publicKey, compliance: Keypair.generate().publicKey, deployer: Keypair.generate().publicKey },
    send: vi.fn(async (role, ixs) => {
      sent.push({ role, ixs });
      return `sig${sent.length}`;
    }),
    loadPool: vi.fn(async () => pool),
    loadProjects: vi.fn(async () => projects),
    tokenBalance: vi.fn(async (a: PublicKey) => over.balances?.get(a.toBase58()) ?? 0n),
    accountExists: vi.fn(async () => false),
    loadFees: vi.fn(async () => (over.fees === undefined ? FEES : over.fees)),
    loadTerms: vi.fn(async () => (over.terms ? (await roundTrip<InstrumentTermsAccount>(program, "instrumentTerms", termsValue(over.terms))).account : null)),
    loadField: vi.fn(async () => (await roundTrip<FieldAccount>(program, "field", fieldValue({ attestationCount: 4 }))).account),
    isKycApproved: vi.fn(async () => over.kyc ?? true),
    now: () => 1_791_000_000,
  };
  return { c, sent, pool, projects };
}

const validPool = {
  poolId: "7",
  crop: "wheat",
  season: 2027,
  name: "Wheat 2027",
  symbol: "WHEAT-2027",
  yieldBps: 800,
  premiumBps: 550,
  arrangementFeeBps: 200,
  closeInMinutes: 10,
  maturityInMinutes: 20,
};

describe("createPool", () => {
  it("validates premium and schedule before anything is sent", () => {
    expect(createPoolInput.safeParse({ ...validPool, premiumBps: 450 }).success).toBe(false);
    expect(createPoolInput.safeParse({ ...validPool, maturityInMinutes: 10 }).success).toBe(false);
    expect(createPoolInput.safeParse({ ...validPool, symbol: "WHEAT-2027X" }).success).toBe(false);
    expect(createPoolInput.safeParse({ ...validPool, arrangementFeeBps: 1_001 }).success).toBe(false);
    expect(createPoolInput.safeParse({ ...validPool, arrangementFeeBps: -1 }).success).toBe(false);
  });

  it("sets the arrangement fee in the same transaction, while the pool is still Draft", async () => {
    const { c, sent } = await ctx();
    await createPool(c, createPoolInput.parse(validPool), "https://f2f.example");
    expect(names(sent[0]!.ixs)).toEqual(["createpool", "setarrangementfee"]);
    const ix = sent[0]!.ixs[1]!;
    expect(ix.keys.some((m) => m.pubkey.equals(termsPda(program.programId, poolPda(program.programId, 7n))))).toBe(true);
    expect((ixCoder(program).decode(ix.data)!.data as { bps: number }).bps).toBe(200);
  });

  it("refuses an arrangement fee above FeeConfig's cap or without FeeConfig", async () => {
    const capped = await ctx({ fees: { ...FEES, maxArrangementBps: 100 } });
    await expect(createPool(capped.c, createPoolInput.parse(validPool), "https://f2f.example")).rejects.toMatchObject({ status: 422 });
    const none = await ctx({ fees: null });
    await expect(createPool(none.c, createPoolInput.parse(validPool), "https://f2f.example")).rejects.toMatchObject({ status: 422 });
    expect(capped.sent).toHaveLength(0);
    // A zero fee needs no FeeConfig and no extra instruction.
    await createPool(none.c, createPoolInput.parse({ ...validPool, arrangementFeeBps: 0 }), "https://f2f.example");
    expect(names(none.sent[0]!.ixs)).toEqual(["createpool"]);
  });

  it("changes the arrangement fee of a Draft pool", async () => {
    const { c, sent } = await ctx({ pool: { status: { draft: {} } } });
    await setArrangementFee(c, 7n, 150);
    expect(names(sent[0]!.ixs)).toEqual(["setarrangementfee"]);
    const closed = await ctx({ pool: { status: { open: {} } } });
    await expect(setArrangementFee(closed.c, 7n, 150)).rejects.toMatchObject({ status: 409 });
  });

  it("sends one Issuer transaction with times relative to now and the instrument URI", async () => {
    const { c, sent } = await ctx();
    const r = await createPool(c, createPoolInput.parse(validPool), "https://f2f.example");
    expect(r.pool).toBe(poolPda(program.programId, 7n).toBase58());
    expect(sent).toHaveLength(1);
    expect(sent[0]?.role).toBe("issuer");
    const d = ixCoder(program).decode(sent[0]!.ixs[0]!.data)!.data as { args: Record<string, unknown> };
    expect(String(d.args.subscriptionCloseTs)).toBe(String(1_791_000_000 + 600));
    expect(String(d.args.maturityTs)).toBe(String(1_791_000_000 + 1200));
    expect(d.args.uri).toBe("https://f2f.example/api/instrument/7");
  });
});

describe("disburseAll", () => {
  it("pays each undisbursed project in its own Issuer transaction", async () => {
    const { c, sent } = await ctx({ pool: { status: { funded: {} } }, projects: [{ disbursed: false }, { disbursed: true }, { disbursed: false }] });
    const sigs = await disburseAll(c, 7n);
    expect(sigs).toEqual(["sig1", "sig2"]);
    expect(sent.every((s) => s.role === "issuer" && names(s.ixs)[0] === "disburse")).toBe(true);
  });

  it("passes the treasury USDC account so the arrangement fee can be withheld", async () => {
    const { c, sent } = await ctx({ pool: { status: { funded: {} } }, projects: [{ disbursed: false }] });
    await disburseAll(c, 7n);
    const ata = getAssociatedTokenAddressSync(c.usdcMint, TREASURY, false, TOKEN_PROGRAM_ID);
    expect(sent[0]!.ixs[0]!.keys.some((m) => m.pubkey.equals(ata))).toBe(true);
  });
});

describe("fundRedemption", () => {
  it("mints the shortfall to the Issuer, then deposits principal plus yield", async () => {
    const { c, sent } = await ctx({ pool: { raisedAmount: new BN(2_000_000_000), yieldBps: 800, maturityTs: new BN(1_790_999_000) } });
    const r = await fundRedemption(c, 7n);
    expect(r.required).toBe(2_160_000_000n);
    expect(r.deposited).toBe(2_160_000_000n);
    expect(r.maturityPassed).toBe(true);
    expect(sent.map((s) => s.role)).toEqual(["deployer", "issuer"]);
    expect(names(sent[1]!.ixs)).toEqual(["fundredemption"]);
  });

  it("only re-checks with amount 0 when the vault already holds enough", async () => {
    const { c, sent, pool } = await ctx({ pool: { raisedAmount: new BN(1_000_000), yieldBps: 800 } });
    vi.mocked(c.tokenBalance).mockImplementation(async (a) => (a.equals(pool.vault) ? 1_080_000n : 0n));
    const r = await fundRedemption(c, 7n);
    expect(r.deposited).toBe(0n);
    expect(sent.map((s) => s.role)).toEqual(["issuer"]);
    const d = ixCoder(program).decode(sent[0]!.ixs[0]!.data)!.data as { amount: BN };
    expect(d.amount.toString()).toBe("0");
  });
});

describe("investor approval", () => {
  it("approves a wallet once for every pool, without touching any pool", async () => {
    const { c, sent, pool } = await ctx();
    const wallet = Keypair.generate().publicKey;
    await approveInvestor(c, wallet);
    expect(sent[0]?.role).toBe("compliance");
    expect(sent[0]!.ixs[0]!.keys.some((m) => m.pubkey.equals(investorPda(program.programId, wallet)))).toBe(true);
    expect(sent[0]!.ixs[0]!.keys.some((m) => m.pubkey.equals(pool.mint))).toBe(false);
    expect(c.loadPool).not.toHaveBeenCalled();
  });

  it("revokes and freezes the pool account only when it exists", async () => {
    const { c, sent, pool } = await ctx();
    const wallet = Keypair.generate().publicKey;
    const ata = getAssociatedTokenAddressSync(pool.mint, wallet, false, TOKEN_2022_PROGRAM_ID);
    await revokeInvestor(c, 7n, wallet);
    expect(sent[0]!.ixs[0]!.keys.some((m) => m.pubkey.equals(ata))).toBe(false);
    vi.mocked(c.accountExists).mockResolvedValue(true);
    await revokeInvestor(c, 7n, wallet);
    expect(sent[1]!.ixs[0]!.keys.some((m) => m.pubkey.equals(ata))).toBe(true);
  });
});

describe("helpers", () => {
  it("picks the next pool id", () => {
    expect(nextPoolId([])).toBe("1");
    expect(nextPoolId(["3", "10", "2"])).toBe("11");
  });

  it("names role keys that differ from Config", () => {
    const config = { admin: "A", issuer: "I", scas: "S", compliance: "C", usdcMint: "U" };
    expect(roleMismatches(config, { issuer: "I", scas: "S", compliance: "C" })).toEqual([]);
    expect(roleMismatches(config, { scas: "X" })).toEqual(["SCAS key in this deployment is X, but Config.scas on devnet is S"]);
  });
});

const FARMER = Keypair.generate().publicKey;
const pilotPool = {
  ...validPool,
  arrangementFeeBps: 0,
  instrument: {
    issuerOfRecord: FARMER.toBase58(),
    unitNominalUsd: 100_000,
    couponBps: 500,
    settlementMode: "Hybrid" as const,
    volumeTonnes: 10_000,
    tokenizedShareBps: 3_000,
    elevator: "Ust-Kamenogorsk",
    lab: "Baltic Control",
  },
};
const SPEC = { hash: "cd".repeat(32), uri: "https://f2f.example/api/evidence/" + "cd".repeat(32) };

describe("pilot pools (ADR 0014)", () => {
  it("creates the pool and its instrument terms in one Issuer transaction, interest from subscription close", async () => {
    const { c, sent } = await ctx();
    await createPool(c, createPoolInput.parse(pilotPool), "https://f2f.example", SPEC);
    expect(names(sent[0]!.ixs)).toEqual(["createpool", "setinstrumentterms"]);
    const ix = sent[0]!.ixs[1]!;
    expect(ix.keys.some((m) => m.pubkey.equals(investorPda(program.programId, FARMER)))).toBe(true);
    expect(ix.keys.some((m) => m.pubkey.equals(instrumentPda(program.programId, poolPda(program.programId, 7n))))).toBe(true);
    const a = (ixCoder(program).decode(ix.data)!.data as { args: Record<string, unknown> }).args;
    expect(String(a.unitNominal)).toBe("100000000000");
    expect(String(a.volumeKg)).toBe("10000000");
    expect(String(a.startTs)).toBe(String(1_791_000_000 + 600));
    expect(a.specUri).toBe(SPEC.uri);
  });

  it("can backdate the interest start for a compressed demo schedule", async () => {
    const { c, sent } = await ctx();
    const input = createPoolInput.parse({ ...pilotPool, instrument: { ...pilotPool.instrument, interestDays: 300 } });
    await createPool(c, input, "https://f2f.example", SPEC);
    const a = (ixCoder(program).decode(sent[0]!.ixs[1]!.data)!.data as { args: Record<string, unknown> }).args;
    expect(String(a.startTs)).toBe(String(1_791_000_000 + 1200 - 300 * 86_400));
  });

  it("refuses an issuer of record without KYC or a pilot pool without a quality spec", async () => {
    const noKyc = await ctx({ kyc: false });
    await expect(createPool(noKyc.c, createPoolInput.parse(pilotPool), "https://f2f.example", SPEC)).rejects.toMatchObject({ status: 422 });
    await expect(createPool(noKyc.c, createPoolInput.parse(pilotPool), "https://f2f.example")).rejects.toMatchObject({ status: 422 });
    expect(noKyc.sent).toHaveLength(0);
  });

  it("validates the term sheet numbers", () => {
    const bad = (o: Record<string, unknown>) => createPoolInput.safeParse({ ...pilotPool, instrument: { ...pilotPool.instrument, ...o } }).success;
    expect(bad({ couponBps: 3_001 })).toBe(false);
    expect(bad({ tokenizedShareBps: 3_001 })).toBe(false);
    expect(bad({ unitNominalUsd: 0 })).toBe(false);
    expect(bad({ elevator: "x".repeat(33) })).toBe(false);
  });

  it("funds a buyback with the Act/360 coupon instead of the flat yield", async () => {
    // 300 days from start to maturity, $1,000,000 raised.
    const maturity = 1_790_999_000;
    const { c } = await ctx({
      pool: { raisedAmount: new BN("1000000000000"), yieldBps: 1_200, maturityTs: new BN(maturity) },
      terms: { startTs: new BN(maturity - 300 * 86_400), election: { buyback: {} } },
    });
    const r = await fundRedemption(c, 7n);
    expect(r.required).toBe(1_041_666_666_666n);
  });

  it("refuses to fund cash redemption once delivery applies", async () => {
    const { c, sent } = await ctx({ terms: { election: { delivery: {} } } });
    await expect(fundRedemption(c, 7n)).rejects.toMatchObject({ status: 409 });
    expect(sent).toHaveLength(0);
  });

  it("elects settlement as the arranger", async () => {
    const { c, sent } = await ctx({ terms: {} });
    await electSettlement(c, 7n, "Buyback");
    expect(sent[0]?.role).toBe("issuer");
    expect(names(sent[0]!.ixs)).toEqual(["electsettlement"]);
  });

  it("records a delivery attestation on the pool's first field at its next sequence", async () => {
    const { c, sent, pool, projects } = await ctx({ terms: { settlementMode: { grainDelivery: {} } }, projects: [{ fieldCount: 2 }] });
    void pool;
    await recordDelivery(c, 7n, { kind: "ElevatorReceipt", verdict: "Pass", evidenceHash: "ef".repeat(32), evidenceUri: "https://f2f.example/api/evidence/x" });
    expect(names(sent[0]!.ixs)).toEqual(["recorddelivery"]);
    const field = sent[0]!.ixs[0]!.keys[5]!.pubkey;
    expect(sent[0]!.ixs[0]!.keys.some((m) => m.pubkey.equals(attestationPda(program.programId, field, 4)))).toBe(true);
    expect(projects).toHaveLength(1);
  });
});

describe("admin test-USDC mint", () => {
  it("mints up to the demo cap to any wallet with the deployer key", async () => {
    const { c, sent } = await ctx();
    const wallet = Keypair.generate().publicKey;
    await adminMintUsdc(c, wallet, 1_000_000);
    expect(sent[0]?.role).toBe("deployer");
    expect(sent[0]!.ixs.map((ix) => ix.programId.toBase58())).toEqual([
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      TOKEN_PROGRAM_ID.toBase58(),
    ]);
    // mintTo data: [7, u64 amount LE]
    expect(Buffer.from(sent[0]!.ixs[1]!.data).readBigUInt64LE(1)).toBe(1_000_000_000_000n);
  });

  it("refuses amounts above the cap or below one dollar", async () => {
    const { c, sent } = await ctx();
    await expect(adminMintUsdc(c, Keypair.generate().publicKey, ADMIN_MINT_MAX_USD + 1)).rejects.toMatchObject({ status: 422 });
    await expect(adminMintUsdc(c, Keypair.generate().publicKey, 0)).rejects.toMatchObject({ status: 422 });
    expect(sent).toHaveLength(0);
  });
});
