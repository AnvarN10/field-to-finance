import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWalletLink, walletLinkMessage } from "../src/lib/wallet-link";

function signWith(kp: Keypair, message: string): string {
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(kp.secretKey.slice(0, 32))]);
  return bs58.encode(sign(null, Buffer.from(message, "utf8"), { key: pkcs8, format: "der", type: "pkcs8" }));
}

describe("wallet link proof", () => {
  const kp = Keypair.generate();
  const wallet = kp.publicKey.toBase58();
  const now = Date.parse("2026-10-05T12:00:00Z");
  const message = walletLinkMessage("user-1", wallet, new Date(now).toISOString());

  it("verifies the wallet's own signature", () => {
    expect(verifyWalletLink({ userId: "user-1", wallet, message, signature: signWith(kp, message), nowMs: now + 1000 })).toBe(true);
  });
  it("refuses another wallet's signature", () => {
    expect(verifyWalletLink({ userId: "user-1", wallet, message, signature: signWith(Keypair.generate(), message), nowMs: now })).toBe(false);
  });
  it("refuses a message older than 10 minutes or naming another account", () => {
    expect(verifyWalletLink({ userId: "user-1", wallet, message, signature: signWith(kp, message), nowMs: now + 11 * 60_000 })).toBe(false);
    expect(verifyWalletLink({ userId: "user-2", wallet, message, signature: signWith(kp, message), nowMs: now })).toBe(false);
  });
  it("refuses malformed input without throwing", () => {
    expect(verifyWalletLink({ userId: "user-1", wallet, message, signature: "not-base58!", nowMs: now })).toBe(false);
    expect(verifyWalletLink({ userId: "user-1", wallet: "bad", message, signature: signWith(kp, message), nowMs: now })).toBe(false);
  });
});
