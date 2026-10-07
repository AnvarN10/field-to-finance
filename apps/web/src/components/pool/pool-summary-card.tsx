import Link from "next/link";
import type { PoolView } from "../../lib/chain/views";
import { formatDateUtc, formatUsd, formatYield } from "../../lib/format";
import { UsdTicker } from "../landing/usd-ticker";
import { PoolStatusBadge } from "../status-badge";

/**
 * headingLevel "h2" where the card sits right under the page h1 (landing hero); "h3" under a section h2.
 * countUp makes the raised amount count up once in view (landing only; app lists never animate numbers).
 */
export function PoolSummaryCard({
  pool,
  headingLevel = "h3",
  countUp = false,
  className = "",
  href,
}: {
  pool: PoolView;
  headingLevel?: "h2" | "h3";
  countUp?: boolean;
  className?: string;
  /** Where the card leads; the public pool page by default, the investor's invest page inside the app. */
  href?: string;
}) {
  const H = headingLevel;
  const symbol = pool.instrument?.symbol ?? `POOL-${pool.poolId}`;
  return (
    <article className={`relative flex flex-col gap-4 rounded-lg border border-border bg-card p-6 text-foreground transition-[border-color,translate] duration-150 ease-(--ease-out) has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-primary/60 motion-reduce:hover:translate-y-0 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <H className="text-xl font-semibold">
          {/* The link covers the whole card so the card is one target. */}
          <Link href={href ?? `/pools/${pool.poolId}`} className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-lg">
            {symbol}
          </Link>
        </H>
        <PoolStatusBadge status={pool.status} />
      </div>
      <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Return</dt>
          <dd className="font-medium text-primary">Fixed yield {formatYield(pool.yieldBps)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Raised</dt>
          <dd className="font-medium">
            {countUp ? <UsdTicker value={pool.raisedAmount} /> : formatUsd(pool.raisedAmount)}
            {` of ${formatUsd(pool.targetAmount)}`}
          </dd>
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
