import { formatUsd } from "../../lib/format";

export type RetailMonitorView = {
  poolId: string;
  symbol: string;
  retailInvestors: number;
  limit: number;
  retailTotal: string;
  totalCap: string;
  investors: { userId: string; email: string; amount: string; belowMinimum: boolean }[];
};

/** Retail subscriptions per pool against the exempt-offer limits (fewer than 50 retail investors, USD 100,000 minimum, USD 5M cap). */
export function RetailMonitorTable({ rows }: { rows: RetailMonitorView[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No pool has subscriptions yet.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((r) => {
        const over = r.retailInvestors >= r.limit || BigInt(r.retailTotal) > BigInt(r.totalCap);
        return (
          <li key={r.poolId} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold">{`${r.symbol} · #${r.poolId}`}</h3>
              {over ? <span className="text-sm font-medium text-destructive">Over the exempt-offer limit</span> : null}
            </div>
            <dl className="tabular grid gap-4 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">Retail investors</dt>
                <dd className="text-xl font-semibold">{`${r.retailInvestors} of ${r.limit - 1}`}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">Raised from retail</dt>
                <dd className="text-xl font-semibold">{formatUsd(r.retailTotal)}</dd>
                <dd className="text-xs text-muted-foreground">{`Cap ${formatUsd(r.totalCap)}`}</dd>
              </div>
            </dl>
            {r.investors.length ? (
              <ul className="flex flex-col divide-y divide-border border-t border-border text-sm">
                {r.investors.map((i) => (
                  <li key={i.userId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                    <span className="min-w-0 break-all">{i.email}</span>
                    <span className="tabular flex flex-wrap items-baseline gap-3">
                      <span className="font-medium">{formatUsd(i.amount)}</span>
                      {i.belowMinimum ? <span className="text-destructive">Below the USD 100,000 minimum</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No retail subscriptions in this pool.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
