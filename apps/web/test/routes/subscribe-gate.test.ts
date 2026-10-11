import { Keypair } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { kfdAcceptances, investorProfiles, wallets } from "../../src/lib/db/schema";
import { testDb } from "../helpers/db";
import { makeUser } from "../helpers/workflow";

const db = await testDb();
const POOL = Keypair.generate().publicKey.toBase58();
let dbDown = false;
let session: { id: string } | null = null;
vi.mock("@/lib/server/auth", () => ({ currentUser: async () => session }));
const buildUserTx = vi.fn(async () => ({ payer: Keypair.generate().publicKey, instructions: [], meta: {} }));
vi.mock("@/lib/server/db", () => ({ getDb: async () => { if (dbDown) throw new Error("down"); return db; } }));
vi.mock("@/lib/chain/user-tx", async (orig) => ({ ...(await orig<typeof import("../../src/lib/chain/user-tx")>()), buildUserTx: (...a: unknown[]) => buildUserTx(...(a as [])) }));
vi.mock("@/lib/chain/send", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/chain/send")>()),
  buildV0: async () => ({ tx: { serialize: () => new Uint8Array([1]) }, blockhash: "b", lastValidBlockHeight: 1 }),
  simulate: async () => ({ err: null, logs: [] }),
}));
vi.mock("@/lib/server/context", () => ({
  getBuildProgram: () => ({}),
  getConnection: () => ({}),
  getStore: () => ({}),
  getUsdcMint: () => ({}),
  sponsorPublicKey: () => ({}),
  getReader: () => ({ getPool: async (id: string) => (id === "rpc-down" ? Promise.reject(new Error("429 Too Many Requests")) : id === "7" ? { pool: { address: POOL, poolId: "7" } } : null), fees: async () => null }),
}));
const route = await import("../../src/app/api/tx/[action]/route");

const call = (action: string, body: unknown) =>
  route.POST(new Request(`http://x/api/tx/${action}`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ action }) });

describe("subscribe gate (KFD before the first subscription)", () => {
  it("refuses an unlinked wallet with a way to onboarding, before anything is built", async () => {
    const w = Keypair.generate().publicKey.toBase58();
    const res = await call("subscribe", { signer: w, poolId: "7", amount: "1000000" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatchObject({ code: "WalletNotLinked", action: "onboarding" });
    expect(buildUserTx).not.toHaveBeenCalled();
  });

  it("asks for the KFD when the investor is onboarded but has not accepted it for this pool, then lets them through", async () => {
    const inv = await makeUser(db, "inv@example.com", ["investor"]);
    const w = Keypair.generate().publicKey.toBase58();
    await db.insert(wallets).values({ address: w, userId: inv.id, kind: "phantom" });
    await db.insert(investorProfiles).values({ userId: inv.id, category: "professional", kycStatus: "approved", riskAckAt: new Date() });
    const res = await call("subscribe", { signer: w, poolId: "7", amount: "1000000" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatchObject({ code: "KfdRequired", action: "kfd" });
    await db.insert(kfdAcceptances).values({ investorUserId: inv.id, poolAddress: POOL, documentHash: "a".repeat(64) });
    expect((await call("subscribe", { signer: w, poolId: "7", amount: "1000000" })).status).toBe(200);
  });

  it("fails closed for subscribe when Postgres is down, but refund still builds", async () => {
    dbDown = true;
    try {
      const w = Keypair.generate().publicKey.toBase58();
      expect((await call("subscribe", { signer: w, poolId: "7", amount: "1000000" })).status).toBe(503);
      expect((await call("refund", { signer: w, poolId: "7", amount: "1000000" })).status).toBe(200);
    } finally {
      dbDown = false;
    }
  });

  it("fails closed when the pool read fails, instead of building an ungated subscribe", async () => {
    buildUserTx.mockClear();
    const res = await call("subscribe", { signer: Keypair.generate().publicKey.toBase58(), poolId: "rpc-down", amount: "1000000" });
    expect(res.status).toBe(503);
    expect(buildUserTx).not.toHaveBeenCalled();
  });

  it("refuses a wallet linked to another account than the signed-in one, though its owner is fully onboarded", async () => {
    const owner = await makeUser(db, "owner@example.com", ["investor"]);
    const signedIn = await makeUser(db, "new@example.com", ["investor"]);
    const w = Keypair.generate().publicKey.toBase58();
    await db.insert(wallets).values({ address: w, userId: owner.id, kind: "phantom" });
    await db.insert(investorProfiles).values({ userId: owner.id, category: "professional", kycStatus: "approved", riskAckAt: new Date() });
    await db.insert(kfdAcceptances).values({ investorUserId: owner.id, poolAddress: POOL, documentHash: "a".repeat(64) });
    try {
      session = { id: signedIn.id };
      const res = await call("subscribe", { signer: w, poolId: "7", amount: "1000000" });
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatchObject({ code: "WalletOtherAccount", action: "none" });
      session = { id: owner.id };
      expect((await call("subscribe", { signer: w, poolId: "7", amount: "1000000" })).status).toBe(200);
    } finally {
      session = null;
    }
  });
});
