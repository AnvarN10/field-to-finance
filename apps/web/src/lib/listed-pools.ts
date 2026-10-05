/**
 * Pools hidden from the public listing (home page and /pools). On-chain pools cannot be deleted, so test and
 * superseded pools are hidden by id through HIDDEN_POOL_IDS (comma-separated). Hidden pools still open by direct
 * link, still show in a holder's portfolio and in the arranger cabinet.
 */
export function parseHiddenPoolIds(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter((s) => /^\d+$/.test(s)));
}

export function listedPools<T extends { poolId: string }>(pools: T[], hidden: Set<string>): T[] {
  return hidden.size ? pools.filter((p) => !hidden.has(p.poolId)) : pools;
}

export const hiddenPoolIds = (): Set<string> => parseHiddenPoolIds(process.env.HIDDEN_POOL_IDS);
