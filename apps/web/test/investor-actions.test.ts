import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { investorProfiles, kfdAcceptances, wallets } from "../src/lib/db/schema";
import { RequestError } from "../src/lib/errors";
import { buildKfd, kfdHash } from "../src/lib/kfd";
import { walletLinkMessage } from "../src/lib/wallet-link";
import { testDb } from "./helpers/db";
import { makeUser } from "./helpers/workflow";

const db = await testDb();
const investor = await makeUser(db, "demo+investor@example.com", ["investor"]);
const POOL = { address: "Poo1A111111111111111111111111111111111111", poolId: "7", issuer: "Issuer11111111111111111111111111111111111", targetAmount: "1000000", yieldBps: 800, maturityTs: 1, subscriptionCloseTs: 1, instrument: { symbol: "D", name: "D" } };
const approveKyc = vi.fn(async () => "sig");
vi.mock("@/lib/server/auth", () => ({ requireActionRole: async () => investor }));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/chain-port", () => ({ arrangerChain: () => ({ approveKyc }) }));
vi.mock("@/lib/server/context", () => ({ getReader: () => ({ getPool: async (id: string) => (id === "7" ? { pool: POOL, terms: null, arrangementFeeBps: 0, projects: [] } : null), fees: async () => null }) }));
const actions = await import("../src/app/investor/actions");

function signWith(kp: Keypair, message: string): string {
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(kp.secretKey.slice(0, 32))]);
  return bs58.encode(sign(null, Buffer.from(message, "utf8"), { key: pkcs8, format: "der", type: "pkcs8" }));
}

describe("investor actions", () => {
  it("links a Phantom wallet only with a valid signed message for this account", async () => {
    const kp = Keypair.generate();
    const address = kp.publicKey.toBase58();
    const message = walletLinkMessage(investor.id, address, new Date().toISOString());
    expect(await actions.linkPhantomAction(address, message, signWith(Keypair.generate(), message))).toEqual({ ok: false, error: "The signature does not match this wallet. Sign the message again." });
    expect(await actions.linkPhantomAction(address, message, signWith(kp, message))).toEqual({ ok: true });
    expect((await db.select().from(wallets)).map((w) => w.address)).toContain(address);
  });

  it("accepts the KFD with the hash the server computes from the chain", async () => {
    await db.insert(investorProfiles).values({ userId: investor.id, category: "professional", kycStatus: "approved", riskAckAt: new Date() }).onConflictDoNothing();
    expect(await actions.acceptKfdAction("7")).toEqual({ ok: true });
    const [row] = await db.select().from(kfdAcceptances);
    expect(row!.documentHash).toBe(kfdHash(buildKfd({ pool: POOL, terms: null, arrangementFeeBps: 0 } as never, null)));
    expect(await actions.acceptKfdAction("99")).toEqual({ ok: false, error: "Pool 99 does not exist" });
  });

  it("validates the questionnaire with field messages", async () => {
    const r = await actions.saveQuestionnaireAction({ category: "professional", netAssets: "1m-10m", experience: "some" });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("basis") });
    void RequestError;
  });
});
