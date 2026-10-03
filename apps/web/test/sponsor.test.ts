import { investorPda } from "@f2f/sdk";
import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { disburseIx, instrumentAta, registerFieldIx, usdcAta } from "../src/lib/chain/ix";
import { cosignAndSend, validateSponsoredTx, type SponsorPolicy } from "../src/lib/chain/sponsor";
import { buildUserTx, type TxAction, type UserTxDeps } from "../src/lib/chain/user-tx";
import type { PoolView } from "../src/lib/chain/views";
import { MemoryStore, polygonKey } from "../src/lib/store";
import { offlineProgram } from "./fixtures/accounts";

const program = offlineProgram();
const sponsor = Keypair.generate().publicKey;
const usdcMint = Keypair.generate().publicKey;
const treasury = Keypair.generate().publicKey;
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

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

const policy: SponsorPolicy = { program, sponsor, usdcMint, treasury, mintFee: 3_000_000n };

async function deps(): Promise<UserTxDeps> {
  const store = new MemoryStore();
  await store.put(polygonKey("aa".repeat(32)), new Uint8Array([1]), "application/json");
  await store.put(polygonKey("bb".repeat(32)), new Uint8Array([1]), "application/json");
  return {
    program,
    store,
    usdcMint,
    sponsor,
    getFees: async () => ({ treasury: treasury.toBase58(), networkFee: "500000", mintFee: "3000000", maxArrangementBps: 1_000 }),
    getPool: async (id) => (id === "7" ? POOL : null),
    now: () => 1_759_500_000_000,
  };
}

function compile(payer: PublicKey, ixs: TransactionInstruction[]): VersionedTransaction {
  const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: Keypair.generate().publicKey.toBase58(), instructions: ixs }).compileToV0Message();
  return new VersionedTransaction(msg);
}

const BODY: Record<TxAction, (signer: PublicKey) => Record<string, unknown>> = {
  "register-project": (s) => ({
    signer: s.toBase58(),
    crop: "wheat",
    season: 2027,
    expectedKg: "400000",
    requestedAmount: "2000000000",
    fields: [
      { polygonHash: "aa".repeat(32), areaHaX100: 7611 },
      { polygonHash: "bb".repeat(32), areaHaX100: 5600 },
    ],
  }),
  subscribe: (s) => ({ signer: s.toBase58(), poolId: "7", amount: "250000000" }),
  refund: (s) => ({ signer: s.toBase58(), poolId: "7", amount: "1" }),
  redeem: (s) => ({ signer: s.toBase58(), poolId: "7", amount: "1" }),
};

async function built(action: TxAction, signer = Keypair.generate().publicKey) {
  const b = await buildUserTx(await deps(), action, BODY[action](signer));
  return { signer, instructions: b.instructions, payer: b.payer };
}

describe("validateSponsoredTx accepts what /api/tx builds", () => {
  it.each(["register-project", "subscribe", "refund", "redeem"] as const)("%s", async (action) => {
    const b = await built(action);
    expect(b.payer.equals(sponsor)).toBe(true);
    expect(validateSponsoredTx(policy, action, compile(sponsor, b.instructions)).signer.equals(b.signer)).toBe(true);
  });

  it("allows a modest compute budget", async () => {
    const b = await built("subscribe");
    const tx = compile(sponsor, [ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }), ...b.instructions]);
    expect(() => validateSponsoredTx(policy, "subscribe", tx)).not.toThrow();
  });
});

describe("validateSponsoredTx reports what the sponsor would pay rent for", () => {
  it("subscribe: the investor's Instrument account", async () => {
    const b = await built("subscribe");
    const r = validateSponsoredTx(policy, "subscribe", compile(sponsor, b.instructions));
    expect(r.rentAccounts.map((k) => k.toBase58())).toEqual([instrumentAta(new PublicKey(POOL.mint), b.signer).toBase58()]);
  });

  it("register-project: the project and its fields, plus the polygon hashes", async () => {
    const b = await built("register-project");
    const r = validateSponsoredTx(policy, "register-project", compile(sponsor, b.instructions));
    expect(r.rentAccounts).toHaveLength(3);
    expect(r.polygonHashes).toEqual(["aa".repeat(32), "bb".repeat(32)]);
  });

  it("refuses to sponsor registration while no mint fee is charged", async () => {
    const b = await built("register-project");
    expect(() => validateSponsoredTx({ ...policy, mintFee: 0n }, "register-project", compile(sponsor, b.instructions))).toThrow(/mint fee/i);
  });
});

describe("validateSponsoredTx rejects", () => {
  it("a different fee payer", async () => {
    const b = await built("subscribe");
    expect(() => validateSponsoredTx(policy, "subscribe", compile(b.signer, b.instructions))).toThrow(/fee payer/i);
  });

  it("an extra instruction that spends the sponsor's SOL", async () => {
    const b = await built("subscribe");
    const drain = SystemProgram.transfer({ fromPubkey: sponsor, toPubkey: b.signer, lamports: 1_000_000 });
    expect(() => validateSponsoredTx(policy, "subscribe", compile(sponsor, [...b.instructions, drain]))).toThrow(/program/i);
  });

  it("a foreign program", async () => {
    const b = await built("subscribe");
    const memo = new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from("hi") });
    expect(() => validateSponsoredTx(policy, "subscribe", compile(sponsor, [memo, ...b.instructions]))).toThrow(/program/i);
  });

  it("a second f2f instruction", async () => {
    const b = await built("subscribe");
    expect(() => validateSponsoredTx(policy, "subscribe", compile(sponsor, [...b.instructions, ...b.instructions]))).toThrow();
  });

  it("an f2f instruction that does not belong to the action", async () => {
    const b = await built("subscribe");
    const d = await disburseIx(program, {
      issuer: b.signer,
      pool: new PublicKey(POOL.address),
      project: Keypair.generate().publicKey,
      producer: Keypair.generate().publicKey,
      usdcMint,
      vault: new PublicKey(POOL.vault),
      treasury,
    });
    expect(() => validateSponsoredTx(policy, "subscribe", compile(sponsor, [d]))).toThrow(/disburse/i);
    expect(() => validateSponsoredTx(policy, "redeem", compile(sponsor, b.instructions))).toThrow(/subscribe/i);
  });

  it("the sponsor in any role other than rent payer", async () => {
    const b = await buildUserTx(await deps(), "subscribe", BODY.subscribe(sponsor));
    expect(() => validateSponsoredTx(policy, "subscribe", compile(sponsor, b.instructions))).toThrow(/sponsor/i);
  });

  it("a rent payer other than the sponsor", async () => {
    const b = await built("subscribe");
    const stranger = Keypair.generate().publicKey;
    const ix = b.instructions[0]!;
    const keys = ix.keys.map((m) => (m.pubkey.equals(sponsor) ? { ...m, pubkey: stranger } : m));
    expect(() => validateSponsoredTx(policy, "subscribe", compile(sponsor, [new TransactionInstruction({ ...ix, keys })]))).toThrow();
  });

  it("a substituted treasury account", async () => {
    const b = await built("subscribe");
    const ix = b.instructions[0]!;
    const real = usdcAta(usdcMint, treasury);
    const fake = usdcAta(usdcMint, b.signer);
    const keys = ix.keys.map((m) => (m.pubkey.equals(real) ? { ...m, pubkey: fake } : m));
    expect(() => validateSponsoredTx(policy, "subscribe", compile(sponsor, [new TransactionInstruction({ ...ix, keys })]))).toThrow(/treasury/i);
  });

  it("an investor record that is not the signer's", async () => {
    const b = await built("subscribe");
    const ix = b.instructions[0]!;
    const real = investorPda(program.programId, b.signer);
    const other = investorPda(program.programId, Keypair.generate().publicKey);
    const keys = ix.keys.map((m) => (m.pubkey.equals(real) ? { ...m, pubkey: other } : m));
    expect(() => validateSponsoredTx(policy, "subscribe", compile(sponsor, [new TransactionInstruction({ ...ix, keys })]))).toThrow(/investorRecord/);
  });

  it("a field registered under another project", async () => {
    const b = await built("register-project");
    const foreign = await registerFieldIx(program, { producer: b.signer, payer: sponsor, project: Keypair.generate().publicKey, index: 1, polygonHash: "bb".repeat(32), areaHaX100: 1 });
    const ixs = [b.instructions[0]!, b.instructions[1]!, foreign];
    expect(() => validateSponsoredTx(policy, "register-project", compile(sponsor, ixs))).toThrow(/account project/i);
  });

  it("a priority fee above the cap", async () => {
    const b = await built("subscribe");
    const tx = compile(sponsor, [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000_000 }), ...b.instructions]);
    expect(() => validateSponsoredTx(policy, "subscribe", tx)).toThrow(/compute/i);
  });

  it("an extra required signer", async () => {
    const b = await built("refund");
    const stranger = Keypair.generate().publicKey;
    const ata = b.instructions[0]!;
    // Re-point the ATA payer at a third key: the transaction now needs three signatures.
    const keys = ata.keys.map((m, i) => (i === 0 ? { ...m, pubkey: stranger } : m));
    expect(() => validateSponsoredTx(policy, "refund", compile(sponsor, [new TransactionInstruction({ ...ata, keys }), b.instructions[1]!]))).toThrow();
  });
});

describe("cosignAndSend", () => {
  const sponsorKey = Keypair.generate();
  const p: SponsorPolicy = { ...policy, sponsor: sponsorKey.publicKey };
  const conn = (send: (raw: Uint8Array) => Promise<string>, existing = false) => ({
    sendRawTransaction: vi.fn(send),
    getMultipleAccountsInfo: vi.fn(async (keys: PublicKey[]) => keys.map(() => (existing ? ({} as never) : null))),
  });
  const extra = { polygonExists: async () => true, allowRent: vi.fn((_w: string) => 0) };

  async function userSigned(action: TxAction) {
    const user = Keypair.generate();
    const d = { ...(await deps()), sponsor: sponsorKey.publicKey };
    const b = await buildUserTx(d, action, BODY[action](user.publicKey));
    const tx = compile(sponsorKey.publicKey, b.instructions);
    tx.sign([user]);
    return { tx, user };
  }

  it("adds the sponsor signature to a valid user-signed transaction and submits it", async () => {
    const { tx } = await userSigned("subscribe");
    const connection = conn(async () => "5sig");
    const sig = await cosignAndSend({ policy: p, sponsorKey, connection, ...extra }, "subscribe", Buffer.from(tx.serialize()).toString("base64"));
    expect(sig).toBe("5sig");
    const sent = VersionedTransaction.deserialize(connection.sendRawTransaction.mock.calls[0]![0]);
    expect(sent.signatures.every((s) => s.some((b) => b !== 0))).toBe(true);
  });

  it("never signs or sends a transaction the validator rejects", async () => {
    const { tx, user } = await userSigned("subscribe");
    const drain = SystemProgram.transfer({ fromPubkey: sponsorKey.publicKey, toPubkey: user.publicKey, lamports: 1 });
    const bad = new VersionedTransaction(
      new TransactionMessage({ payerKey: sponsorKey.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58(), instructions: [drain] }).compileToV0Message(),
    );
    const connection = conn(async () => "x");
    await expect(cosignAndSend({ policy: p, sponsorKey, connection, ...extra }, "subscribe", Buffer.from(bad.serialize()).toString("base64"))).rejects.toMatchObject({ status: 400 });
    expect(connection.sendRawTransaction).not.toHaveBeenCalled();
    void tx;
  });

  it("refuses a transaction the wallet has not signed", async () => {
    const user = Keypair.generate();
    const b = await buildUserTx({ ...(await deps()), sponsor: sponsorKey.publicKey }, "subscribe", BODY.subscribe(user.publicKey));
    const tx = compile(sponsorKey.publicKey, b.instructions);
    const connection = conn(async () => "x");
    await expect(cosignAndSend({ policy: p, sponsorKey, connection, ...extra }, "subscribe", Buffer.from(tx.serialize()).toString("base64"))).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/wallet signature/i) });
    expect(connection.sendRawTransaction).not.toHaveBeenCalled();
  });

  it("rejects bytes that are not a transaction", async () => {
    await expect(cosignAndSend({ policy: p, sponsorKey, connection: conn(async () => "x"), ...extra }, "subscribe", "bm90IGEgdHg=")).rejects.toMatchObject({ status: 400 });
  });

  it("budgets sponsored rent per wallet: only transactions that create accounts count", async () => {
    const { tx, user } = await userSigned("subscribe");
    const b64 = Buffer.from(tx.serialize()).toString("base64");
    const allowRent = vi.fn((_w: string) => 0);
    await cosignAndSend({ policy: p, sponsorKey, connection: conn(async () => "s1", true), polygonExists: async () => true, allowRent }, "subscribe", b64);
    expect(allowRent).not.toHaveBeenCalled();
    await cosignAndSend({ policy: p, sponsorKey, connection: conn(async () => "s2", false), polygonExists: async () => true, allowRent }, "subscribe", b64);
    expect(allowRent).toHaveBeenCalledWith(user.publicKey.toBase58());
  });

  it("refuses to pay rent beyond the wallet's budget", async () => {
    const { tx } = await userSigned("redeem");
    const connection = conn(async () => "x", false);
    await expect(
      cosignAndSend({ policy: p, sponsorKey, connection, polygonExists: async () => true, allowRent: () => 120 }, "redeem", Buffer.from(tx.serialize()).toString("base64")),
    ).rejects.toMatchObject({ status: 429 });
    expect(connection.sendRawTransaction).not.toHaveBeenCalled();
  });

  it("refuses to register fields whose boundaries were never uploaded", async () => {
    const { tx } = await userSigned("register-project");
    const connection = conn(async () => "x");
    await expect(
      cosignAndSend({ policy: p, sponsorKey, connection, polygonExists: async (h) => h !== "bb".repeat(32), allowRent: () => 0 }, "register-project", Buffer.from(tx.serialize()).toString("base64")),
    ).rejects.toMatchObject({ status: 422 });
    expect(connection.sendRawTransaction).not.toHaveBeenCalled();
  });
});
