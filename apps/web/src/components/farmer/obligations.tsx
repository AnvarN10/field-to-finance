import { formatDateUtc, formatUsd, formatUsdDown } from "../../lib/format";

/** One pool the farmer issued, with amounts as base-unit strings (bigint does not cross to client components). */
export type ObligationItem = {
  symbol: string;
  principal: string;
  dueAtMaturity: string;
  accrued: string | null;
  maturityTs: number;
  settlementLabel: string | null;
  vaultBalance: string;
  buybackShortfall: string;
};

/** What the farmer owes holders: Act/360 accrual to date, amount due and the buyback funding still missing. */
export function Obligations({ items }: { items: ObligationItem[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {items.map((o) => (
        <section key={o.symbol} aria-label={`Obligations for ${o.symbol}`} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold">{o.symbol}</h3>
          <dl className="tabular grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Due at maturity</dt>
              <dd className="text-xl font-semibold text-primary">{formatUsdDown(o.dueAtMaturity)}</dd>
              <dd className="text-xs text-muted-foreground">{`Principal ${formatUsd(o.principal)}`}</dd>
            </div>
            {o.accrued !== null ? (
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">Coupon accrued to date</dt>
                <dd className="text-xl font-semibold">{formatUsdDown(o.accrued)}</dd>
                <dd className="text-xs text-muted-foreground">Act/360, whole days</dd>
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Maturity</dt>
              <dd className="font-medium">{formatDateUtc(o.maturityTs)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Buyback funding</dt>
              <dd className="font-medium">{BigInt(o.buybackShortfall) === 0n ? "Funded" : `Short by ${formatUsdDown(o.buybackShortfall)}`}</dd>
              <dd className="text-xs text-muted-foreground">{`Vault holds ${formatUsd(o.vaultBalance)}`}</dd>
            </div>
          </dl>
          {o.settlementLabel ? <p className="text-sm text-muted-foreground">{o.settlementLabel}</p> : null}
        </section>
      ))}
    </div>
  );
}
