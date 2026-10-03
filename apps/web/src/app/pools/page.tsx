import type { Metadata } from "next";
import { PoolSummaryCard } from "@/components/pool/pool-summary-card";
import { EmptyState, ErrorState } from "@/components/state";
import { staggerDelay } from "@/lib/motion";
import { getReader } from "@/lib/server/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pools" };

export default async function PoolsPage() {
  let pools;
  try {
    pools = await getReader().listPools();
  } catch {
    return <ErrorState level={1} title="Could not load pools" body="Solana devnet did not answer. This is usually brief." retryHref="/pools" />;
  }
  const open = pools.filter((p) => p.status === "Open");
  const rest = pools.filter((p) => p.status !== "Open");
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Pools</h1>
        <p className="text-muted-foreground">Each pool finances verified farm projects for one crop and season with a fixed USDC yield.</p>
      </header>
      {pools.length === 0 ? (
        <EmptyState title="No pools yet" body="Pools appear here once the Issuer creates one from verified farm projects." />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">Open for subscription</h2>
            {open.length ? (
              <div className="grid gap-4 md:grid-cols-2">{open.map((p, i) => (
                <div key={p.address} className="enter-row" style={{ animationDelay: staggerDelay(i) }}>
                  <PoolSummaryCard pool={p} className="h-full" />
                </div>
              ))}</div>
            ) : (
              <p className="text-sm text-muted-foreground">No pool is open right now.</p>
            )}
          </section>
          {rest.length ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-base font-semibold">Other pools</h2>
              <div className="grid gap-4 md:grid-cols-2">{rest.map((p, i) => (
                <div key={p.address} className="enter-row" style={{ animationDelay: staggerDelay(i) }}>
                  <PoolSummaryCard pool={p} className="h-full" />
                </div>
              ))}</div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
