import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstrumentCard } from "@/components/pool/instrument-card";
import { InvestPanel } from "@/components/pool/invest-panel";
import { ErrorState } from "@/components/state";
import { getReader } from "@/lib/server/context";
import { serverEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ poolId: string }> }): Promise<Metadata> {
  const { poolId } = await params;
  return { title: `Pool ${poolId}` };
}

export default async function PoolPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  let detail;
  try {
    detail = await getReader().getPool(poolId);
  } catch {
    return <ErrorState level={1} title="Could not load this pool" body="Solana devnet did not answer." retryHref={`/pools/${poolId}`} />;
  }
  if (!detail) notFound();
  const symbol = detail.pool.instrument?.symbol ?? `POOL-${poolId}`;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Pool {poolId}</p>
        <h1 className="text-2xl font-semibold">{symbol}</h1>
        <p className="text-muted-foreground">{detail.pool.instrument?.name}</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* DOM order matches the phone order (panel first); on lg the grid places the panel in the right column. */}
        <aside id="invest" className="lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1">
          <InvestPanel pool={detail.pool} />
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <InstrumentCard detail={detail} cluster={serverEnv().SOLANA_CLUSTER} />
        </div>
      </div>
    </div>
  );
}
