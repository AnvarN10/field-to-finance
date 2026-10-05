import { fieldPda, investorPda, projectPda } from "@f2f/sdk";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import type { PoolView } from "../src/lib/chain/views";
import { buildUserTx, type UserTxDeps } from "../src/lib/chain/user-tx";
import { MemoryStore, polygonKey } from "../src/lib/store";
import { offlineProgram } from "./fixtures/accounts";

const program = offlineProgram();
const pid = program.programId;
const norm = (s: string) => s.replace(/_/g, "").toLowerCase();
const coder = program.coder.instruction as unknown as { decode(data: Buffer): { name: string } | null };
const nameOf = (data: Buffer) => norm(coder.decode(data)?.name ?? "");

const POOL: PoolView = {
  address: Keypair.generate().publicKey.toBase58(),
  poolId: "7",
  issuer: Keypair.generate().publicKey.toBase58(),
  mint: Keypair.generate().publicKey.toBase58(),
  vault: Keypair.generate().publicKey.toBase58(),
  crop: "wheat",
  season: 2027,
  targetAmount: "2000000000",
  raisedAmount: "0",
  yieldBps: 800,
  premiumBps: 550,
  subscriptionCloseTs: 1_791_000_600,
  maturityTs: 1_791_001_200,
  projectCount: 1,
  disbursedCount: 0,
  settledCount: 0,
  status: "Open",
  instrument: null,
};

const sponsor = Keypair.generate().publicKey;
const usdcMint = Keypair.generate().publicKey;
const treasury = Keypair.generate().publicKey;
const FEES = { treasury: treasury.toBase58(), networkFee: "500000", mintFee: "3000000", maxArrangementBps: 1_000 };

function deps(store = new MemoryStore(), fees: typeof FEES | null = FEES): UserTxDeps {
  return {
    program,
    store,
    usdcMint,
    sponsor,
    getFees: async () => fees,
    getPool: async (id) => (id === "7" ? POOL : null),
    now: () => 1_759_500_000_000,
  };
}

describe("buildUserTx", () => {
  it("registers a project and its fields in one transaction", async () => {
    const store = new MemoryStore();
    const h1 = "aa".repeat(32);
    const h2 = "bb".repeat(32);
    await store.put(polygonKey(h1), new Uint8Array([1]), "application/json");
    await store.put(polygonKey(h2), new Uint8Array([2]), "application/json");
    const producer = Keypair.generate().publicKey;
    const built = await buildUserTx(deps(store), "register-project", {
      signer: producer.toBase58(),
      crop: "wheat",
      season: 2027,
      expectedKg: "400000",
      requestedAmount: "2000000000",
      fields: [
        { polygonHash: h1, areaHaX100: 7611 },
        { polygonHash: h2, areaHaX100: 5600 },
      ],
    });
    const project = projectPda(pid, producer, 1_759_500_000_000n);
    expect(built.payer.equals(sponsor)).toBe(true);
    expect(built.instructions.map((ix) => nameOf(ix.data))).toEqual(["registerproject", "registerfield", "registerfield"]);
    expect(built.instructions[2]?.keys[3]?.pubkey.equals(fieldPda(pid, project, 1))).toBe(true);
    for (const ix of built.instructions) expect(ix.keys[1]?.pubkey.equals(sponsor)).toBe(true);
    // Mint fee: the producer's USDC account and the treasury account ride on register_project.
    const keys = built.instructions[0]!.keys.map((m) => m.pubkey.toBase58());
    expect(keys).toContain(getAssociatedTokenAddressSync(usdcMint, producer, false, TOKEN_PROGRAM_ID).toBase58());
    expect(keys).toContain(getAssociatedTokenAddressSync(usdcMint, treasury, false, TOKEN_PROGRAM_ID).toBase58());
    expect(built.meta).toEqual({ projectId: "1759500000000", project: project.toBase58() });
  });

  it("refuses fields whose boundary was never uploaded", async () => {
    await expect(
      buildUserTx(deps(), "register-project", {
        signer: Keypair.generate().publicKey.toBase58(),
        crop: "wheat",
        season: 2027,
        expectedKg: "1",
        requestedAmount: "1",
        fields: [{ polygonHash: "cc".repeat(32), areaHaX100: 1 }],
      }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/Field 1 boundary/) });
  });

  it("rejects malformed bodies with the offending fields named", async () => {
    await expect(buildUserTx(deps(), "subscribe", { signer: "x", poolId: "7", amount: "-1" })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/signer.*amount|amount.*signer/s),
    });
  });

  it("subscribes in one instruction that creates the instrument account itself", async () => {
    const investor = Keypair.generate().publicKey;
    const built = await buildUserTx(deps(), "subscribe", { signer: investor.toBase58(), poolId: "7", amount: "250000000" });
    expect(built.instructions).toHaveLength(1);
    expect(nameOf(built.instructions[0]!.data)).toBe("subscribe");
    expect(built.instructions[0]?.keys.some((m) => m.pubkey.equals(investorPda(pid, investor)))).toBe(true);
    expect(built.payer.equals(sponsor)).toBe(true);
    expect(built.instructions[0]?.keys.some((m) => m.pubkey.equals(getAssociatedTokenAddressSync(usdcMint, treasury, false, TOKEN_PROGRAM_ID)))).toBe(true);
  });

  it("passes no fee accounts when fees are not configured", async () => {
    const investor = Keypair.generate().publicKey;
    const built = await buildUserTx(deps(new MemoryStore(), null), "subscribe", { signer: investor.toBase58(), poolId: "7", amount: "1" });
    expect(built.instructions[0]?.keys.some((m) => m.pubkey.equals(getAssociatedTokenAddressSync(usdcMint, treasury, false, TOKEN_PROGRAM_ID)))).toBe(false);
  });

  it("refuses to build when no gas sponsor is configured", async () => {
    const d = { ...deps(), sponsor: null };
    await expect(buildUserTx(d, "subscribe", { signer: Keypair.generate().publicKey.toBase58(), poolId: "7", amount: "1" })).rejects.toMatchObject({ status: 503 });
  });

  it("returns 404 for an unknown pool", async () => {
    await expect(buildUserTx(deps(), "redeem", { signer: Keypair.generate().publicKey.toBase58(), poolId: "8", amount: "1" })).rejects.toMatchObject({ status: 404 });
  });

  it("creates the USDC account before refund and redeem, rent paid by the sponsor", async () => {
    for (const action of ["refund", "redeem"] as const) {
      const built = await buildUserTx(deps(), action, { signer: Keypair.generate().publicKey.toBase58(), poolId: "7", amount: "1" });
      expect(built.instructions[0]?.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
      expect(built.instructions[0]?.keys[0]?.pubkey.equals(sponsor)).toBe(true);
      expect(nameOf(built.instructions[1]!.data)).toBe(action);
    }
  });

  it("builds the issuer's election and buyback deposit, signed by the issuer of record, paid by the sponsor", async () => {
    const issuer = POOL.issuer;
    const elect = await buildUserTx(deps(), "elect-settlement", { signer: issuer, poolId: "7", election: "Delivery" });
    expect(elect.instructions.map((i) => nameOf(i.data))).toEqual(["electsettlement"]);
    expect(elect.payer.equals(sponsor)).toBe(true);
    const fund = await buildUserTx(deps(), "fund-redemption", { signer: issuer, poolId: "7", amount: "1050000000" });
    expect(fund.instructions.map((i) => nameOf(i.data))).toEqual(["fundredemption"]);
    expect(fund.instructions[0]?.keys[0]?.pubkey.toBase58()).toBe(issuer);
    expect(fund.instructions[0]?.keys.some((k) => k.pubkey.equals(sponsor))).toBe(false);
  });

  it("refuses a settlement transaction from a wallet that is not the pool's issuer of record", async () => {
    const other = Keypair.generate().publicKey.toBase58();
    await expect(buildUserTx(deps(), "elect-settlement", { signer: other, poolId: "7", election: "Buyback" })).rejects.toMatchObject({ status: 403 });
    await expect(buildUserTx(deps(), "fund-redemption", { signer: other, poolId: "7", amount: "1" })).rejects.toMatchObject({ status: 403 });
    await expect(buildUserTx(deps(), "elect-settlement", { signer: POOL.issuer, poolId: "7", election: "Later" })).rejects.toMatchObject({ status: 400 });
    await expect(buildUserTx(deps(), "fund-redemption", { signer: POOL.issuer, poolId: "7", amount: "0" })).rejects.toMatchObject({ status: 400 });
  });
});
