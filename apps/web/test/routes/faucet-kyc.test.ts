import { Keypair } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runFaucet = vi.fn(async () => ({ signature: "s", usdc: "1", sol: 1 }));
const approveInvestor = vi.fn(async () => "sig");
const investor = vi.fn(async () => ({ approved: false }));
vi.mock("@/lib/chain/faucet", () => ({ runFaucet: (...a: unknown[]) => runFaucet(...(a as [])) }));
vi.mock("@/lib/chain/admin-ops", () => ({ approveInvestor: (...a: unknown[]) => approveInvestor(...(a as [])) }));
vi.mock("@/lib/server/context", () => ({ faucetDeps: () => ({}), opsContext: () => ({}), getReader: () => ({ investor }), invalidateReads: vi.fn() }));
const faucet = await import("../../src/app/api/faucet/route");
const kyc = await import("../../src/app/api/kyc/route");

const post = (url: string, body: unknown, ip = "9.9.9.9") =>
  new Request(url, { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) });
const kycBody = () => ({ wallet: Keypair.generate().publicKey.toBase58(), fullName: "Aigerim Sadykova", country: "Kazakhstan", email: "a@example.com", eligible: true, demoConsent: true });

beforeEach(() => {
  runFaucet.mockClear();
  approveInvestor.mockClear();
});

describe("public routes that spend role keys", () => {
  it("faucet: one IP cannot farm funds with fresh wallets", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await faucet.POST(post("http://x/api/faucet", { wallet: Keypair.generate().publicKey.toBase58(), usdc: true }, "1.1.1.1"))).status);
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(3);
    expect(statuses.at(-1)).toBe(429);
  });

  it("kyc: instant approval is gone; onboarding goes through the investor app", async () => {
    const r = await kyc.POST();
    expect(r.status).toBe(410);
    expect((await r.json()).error.title).toBe("KYC moved to the investor app");
    expect(approveInvestor).not.toHaveBeenCalled();
  });
});
