/** Client-safe half of the wallet-link proof: the message the wallet signs. Verification is in wallet-link.ts (server). */
export const WALLET_LINK_TTL_MS = 10 * 60_000;

export const walletLinkMessage = (userId: string, wallet: string, issuedAtIso: string) =>
  `Field-to-Finance wants you to link wallet ${wallet} to account ${userId}.\nIssued at: ${issuedAtIso}`;
