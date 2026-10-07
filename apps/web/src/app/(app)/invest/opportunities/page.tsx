import type { Metadata } from "next";
import { PoolSummaryCard } from "@/components/pool/pool-summary-card";
import { guardAccount } from "@/components/shell/account-guard";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, ErrorState } from "@/components/state";
import { hiddenPoolIds, listedPools } from "@/lib/listed-pools";
import { getReader } from "@/lib/server/context";

export const metadata: Metadata = { title: "Opportunities" };
export const dynamic = "force-dynamic";

export default async function InvestOpportunities() {
  const g = await guardAccount("investor", "/invest/opportunities");
  if ("element" in g) return g.element;
  let pools;
  try {
    pools = listedPools(await getReader().listPools(), hiddenPoolIds());
  } catch {
    return <ErrorState level={1} title="Could not load pools" body="Solana devnet did not answer. This is usually brief." retryHref="/invest/opportunities" />;
  }
  const open = pools.filter((p) => p.status === "Open");
  const rest = pools.filter((p) => p.status !== "Open");
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Opportunities" description="Each pool finances verified farm projects for one crop and season with a fixed USDC coupon. Open a pool to read its key features and subscribe." />
      <section aria-labelledby="open-pools" className="flex flex-col gap-4">
        <h2 id="open-pools" className="text-xl font-semibold">
          Open for subscription
        </h2>
        {open.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {open.map((p) => (
              <PoolSummaryCard key={p.address} pool={p} href={`/invest/pools/${p.poolId}`} className="h-full" />
            ))}
          </div>
        ) : (
          <EmptyState title="No pool is open right now" body="New pools open after the arranger structures verified farm projects. You get an update when one opens." />
        )}
      </section>
      {rest.length ? (
        <section aria-labelledby="other-pools" className="flex flex-col gap-4">
          <h2 id="other-pools" className="text-xl font-semibold">
            Funded and settling
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {rest.map((p) => (
              <PoolSummaryCard key={p.address} pool={p} href={`/invest/pools/${p.poolId}`} className="h-full" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
