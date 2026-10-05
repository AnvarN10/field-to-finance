import { createPublicKey, verify } from "node:crypto";
import bs58 from "bs58";

/** A signed message proves the investor controls a wallet before it is linked (Phantom; Privy wallets come from Privy). */
export const WALLET_LINK_TTL_MS = 10 * 60_000;

export const walletLinkMessage = (userId: string, wallet: string, issuedAtIso: string) =>
  `Field-to-Finance wants you to link wallet ${wallet} to account ${userId}.\nIssued at: ${issuedAtIso}`;

function decode58(s: string): Uint8Array | null {
  try {
    return bs58.decode(s);
  } catch {
    return null;
  }
}

export function verifyWalletLink(p: { userId: string; wallet: string; message: string; signature: string; nowMs: number }): boolean {
  const m = /^Field-to-Finance wants you to link wallet (\S+) to account (\S+)\.\nIssued at: (\S+)$/.exec(p.message);
  if (!m || m[1] !== p.wallet || m[2] !== p.userId) return false;
  const issued = Date.parse(m[3] as string);
  if (!Number.isFinite(issued) || p.nowMs - issued > WALLET_LINK_TTL_MS || issued - p.nowMs > 60_000) return false;
  const key = decode58(p.wallet);
  const sig = decode58(p.signature);
  if (!key || key.length !== 32 || !sig || sig.length !== 64) return false;
  try {
    const publicKey = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(key).toString("base64url") }, format: "jwk" });
    return verify(null, Buffer.from(p.message, "utf8"), publicKey, sig);
  } catch {
    return false;
  }
}
