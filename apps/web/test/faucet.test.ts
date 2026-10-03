import { Keypair, SystemProgram } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { createCooldown } from "../src/lib/cooldown";
import { SOL_TOPUP_LAMPORTS, runFaucet, type FaucetDeps } from "../src/lib/chain/faucet";

function deps(balance: number, cooldown = createCooldown(60_000, () => 0), sol = true): FaucetDeps {
  return {
    sol,
    connection: { getBalance: vi.fn(async () => balance) },
    usdcMint: Keypair.generate().publicKey,
    deployer: Keypair.generate().publicKey,
    send: vi.fn(async () => "sigF"),
    usdcAmount: 1_000_000_000n,
    cooldown,
  };
}

describe("runFaucet", () => {
  it("tops up SOL when low and mints USDC when asked", async () => {
    const d = deps(0);
    const r = await runFaucet(d, Keypair.generate().publicKey, { usdc: true });
    expect(r).toEqual({ signature: "sigF", solLamports: SOL_TOPUP_LAMPORTS, usdc: "1000000000" });
    const ixs = vi.mocked(d.send).mock.calls[0]![0];
    expect(ixs[0]?.programId.equals(SystemProgram.programId)).toBe(true);
    expect(ixs).toHaveLength(3); // transfer, create ATA, mintTo
  });

  it("sends test USDC only, never SOL, when the SOL top-up is off (ADR 0013)", async () => {
    const d = deps(0, createCooldown(60_000, () => 0), false);
    const r = await runFaucet(d, Keypair.generate().publicKey, { usdc: true });
    expect(r).toEqual({ signature: "sigF", solLamports: 0, usdc: "1000000000" });
    const ixs = vi.mocked(d.send).mock.calls[0]![0];
    expect(ixs.some((ix) => ix.programId.equals(SystemProgram.programId))).toBe(false);
    expect(d.connection.getBalance).not.toHaveBeenCalled();
  });

  it("does nothing when the wallet already has SOL and no USDC is asked", async () => {
    const d = deps(1_000_000_000);
    expect(await runFaucet(d, Keypair.generate().publicKey, { usdc: false })).toEqual({ signature: null, solLamports: 0, usdc: "0" });
    expect(d.send).not.toHaveBeenCalled();
  });

  it("enforces a per-wallet cooldown with a readable wait time", async () => {
    let t = 0;
    const d = deps(0, createCooldown(60_000, () => t));
    const w = Keypair.generate().publicKey;
    await runFaucet(d, w, { usdc: true });
    t = 15_000;
    await expect(runFaucet(d, w, { usdc: true })).rejects.toMatchObject({ status: 429, message: "Try again in 45 s" });
    t = 60_000;
    await expect(runFaucet(d, w, { usdc: true })).resolves.toMatchObject({ signature: "sigF" });
  });
});
