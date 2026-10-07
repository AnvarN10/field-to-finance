import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PoolConsole } from "@/components/admin/pool-console";
import { LifecycleBoard } from "@/components/arranger/lifecycle-board";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { Panel, textLink } from "@/components/cabinet/section";
import { ErrorState } from "@/components/state";
import { lifecycle } from "@/lib/lifecycle";
import { vaultBalance } from "@/lib/server/cabinet-data";
import { getReader } from "@/lib/server/context";

export const metadata: Metadata = { title: "Pool" };
export const dynamic = "force-dynamic";

export default async function ArrangerPool({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const g = await guardConsole("pools.view", `/console/pools/${poolId}`);
  if ("element" in g) return g.element;
  let detail, unpooled, vault;
  try {
    detail = await getReader().getPool(poolId);
    if (detail) {
      unpooled = await getReader().unpooledProjects();
      vault = await vaultBalance(detail.pool.vault);
    }
  } catch {
    return <ErrorState level={1} title="Could not load this pool" body="Solana devnet did not answer." retryHref={`/console/pools/${poolId}`} />;
  }
  if (!detail) notFound();
  const now = Math.floor(Date.now() / 1000);
  const symbol = detail.pool.instrument?.symbol ?? `POOL-${poolId}`;
  return (
    <ConsolePage title={`${symbol} · pool ${poolId}`}>
      <div className="-mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Link href="/console/pools" className={textLink}>
          Back to live pools
        </Link>
        <Link href={`/pools/${poolId}`} className={textLink}>
          Public pool page
        </Link>
        <a href={`/api/arranger/report/${poolId}`} className={textLink}>
          Final report (CSV)
        </a>
      </div>
      <Panel>
        <h2 className="text-base font-semibold">Lifecycle</h2>
        <LifecycleBoard poolId={poolId} phases={lifecycle(detail, now, vault)} canAct={g.permissions.has("pools.operate")} />
      </Panel>
      {g.permissions.has("pools.operate") ? (
      <details className="rounded-lg border border-border bg-card p-6">
        <summary className="cursor-pointer text-base font-semibold select-none">Manual pilot tools for this pool</summary>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">For exceptions only: every step above has its owner and its console section.</p>
        <div className="mt-6">
          <PoolConsole detail={detail} unpooled={unpooled ?? []} now={now} />
        </div>
      </details>
      ) : null}
    </ConsolePage>
  );
}
