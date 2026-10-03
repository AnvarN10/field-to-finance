import type { PoolView } from "./chain/views";

export interface LandingStats {
  openPools: number;
  totalRaised: string;
  featured: PoolView | null;
}

export function landingStats(pools: PoolView[]): LandingStats {
  const open = pools.filter((p) => p.status === "Open").sort((a, b) => b.subscriptionCloseTs - a.subscriptionCloseTs);
  const newest = [...pools].sort((a, b) => (BigInt(b.poolId) > BigInt(a.poolId) ? 1 : -1))[0] ?? null;
  return {
    openPools: open.length,
    totalRaised: pools.reduce((s, p) => s + BigInt(p.raisedAmount), 0n).toString(),
    featured: open[0] ?? newest,
  };
}
