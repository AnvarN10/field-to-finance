import Link from "next/link";
import type { PoolView } from "../../lib/chain/views";
import { formatDateUtc, formatUsd, formatYield } from "../../lib/format";
import { PoolStatusBadge } from "../status-badge";

export function PoolSummaryCard({ pool }: { pool: PoolView }) {
  const symbol = pool.instrument?.symbol ?? `POOL-${pool.poolId}`;
  return (
    <article className="relative flex flex-col gap-4 rounded-lg border border-border bg-card p-6 text-foreground transition-colors duration-150 ease-(--ease-out) has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring [.dark-band_&]:has-[a:focus-visible]:outline-[#e6ca8b] [@media(hover:hover)]:hover:border-primary">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold">
          {/* The link covers the whole card so the card is one target. */}
          <Link href={`/pools/${pool.poolId}`} className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-lg">
            {symbol}
          </Link>
        </h3>
        <PoolStatusBadge status={pool.status} />
      </div>
      <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Return</dt>
          <dd className="font-medium text-gold-text">Fixed yield {formatYield(pool.yieldBps)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Raised</dt>
          <dd className="font-medium">{`${formatUsd(pool.raisedAmount)} of ${formatUsd(pool.targetAmount)}`}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Crop</dt>
          <dd>
            <span className="capitalize">{pool.crop}</span>, season {pool.season}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Maturity</dt>
          <dd>{formatDateUtc(pool.maturityTs)}</dd>
        </div>
      </dl>
    </article>
  );
}
