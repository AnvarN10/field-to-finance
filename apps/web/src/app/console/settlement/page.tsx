import type { Metadata } from "next";
import Link from "next/link";
import { LifecycleBoard } from "@/components/arranger/lifecycle-board";
import { PoolStatusBadge } from "@/components/status-badge";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { EmptyState, ErrorState } from "@/components/state";
import { formatDateUtc } from "@/lib/format";
import { boardDetails, lifecycle } from "@/lib/lifecycle";
import { vaultBalances } from "@/lib/server/cabinet-data";
import { getReader } from "@/lib/server/context";

export const metadata: Metadata = { title: "Settlement" };
export const dynamic = "force-dynamic";

/** Phases of a pool's life that belong to settlement (spec §6.3): harvest and delivery, settlement, closing. */
const SETTLEMENT_PHASES = new Set(["harvest", "settlement", "closing"]);

export default async function SettlementQueue() {
  const g = await guardConsole("pools.operate", "/console/settlement");
  if ("element" in g) return g.element;
  const now = Math.floor(Date.now() / 1000);
  let rows;
  try {
    const reader = getReader();
    const pools = await reader.listPools();
    const details = boardDetails(pools, await reader.allProjects());
    const vaults = await vaultBalances(pools.filter((p) => p.status !== "Draft"));
    rows = details
      .map((d) => ({ d, phases: lifecycle(d, now, vaults.get(d.pool.poolId)) }))
      .filter(({ phases }) => {
        const current = phases.find((p) => p.state === "current");
        return current && SETTLEMENT_PHASES.has(current.key);
      })
      .sort((a, b) => a.d.pool.maturityTs - b.d.pool.maturityTs);
  } catch {
    return <ErrorState level={1} title="Could not load devnet state" body="Solana devnet did not answer." retryHref="/console/settlement" />;
  }
  return (
    <ConsolePage title="Settlement" description="Pools at harvest, settlement or closing, earliest maturity first: the election, buyback funding, delivery documents, redemption and sweep.">
      {rows.length === 0 ? (
        <EmptyState title="No pool is in settlement" body="Pools appear here from harvest on. Open Pools for every pool's lifecycle." action={<Link href="/console/pools" className="rounded-sm text-sm font-medium underline decoration-muted-foreground underline-offset-4">Open Pools</Link>} />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map(({ d, phases }) => (
            <li key={d.pool.address} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold">
                    <Link href={`/console/pools/${d.pool.poolId}`} className="rounded-sm underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current">
                      {`${d.pool.instrument?.symbol ?? "Pool"} · #${d.pool.poolId}`}
                    </Link>
                  </h2>
                  <p className="tabular text-sm text-muted-foreground">{`Matures ${formatDateUtc(d.pool.maturityTs)}`}</p>
                </div>
                <PoolStatusBadge status={d.pool.status} />
              </div>
              <LifecycleBoard poolId={d.pool.poolId} phases={phases} compact />
            </li>
          ))}
        </ul>
      )}
    </ConsolePage>
  );
}
