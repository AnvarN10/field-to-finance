import type { SettlementElectionName, SettlementModeName } from "@f2f/sdk";
import type { PoolStatusName } from "../../lib/chain/enums";
import { formatDateUtc, formatUsd, formatUsdDown } from "../../lib/format";
import { ObligationActions } from "./obligation-actions";

/** One pool the farmer issued, with amounts as base-unit strings (bigint does not cross to client components). */
export type ObligationItem = {
  poolId: string;
  symbol: string;
  /** The issuer of record's wallet (signs the election and the buyback deposit). */
  issuer: string;
  status: PoolStatusName;
  settlementMode: SettlementModeName | null;
  election: SettlementElectionName | null;
  effectiveElection: SettlementElectionName | null;
  /** An elected buyback still unfunded at this time lapses into delivery (maturity + 7 days). */
  lapseTs: number;
  allDisbursed: boolean;
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
        <section key={o.poolId} aria-label={`Obligations for ${o.symbol}, pool ${o.poolId}`} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold">{`${o.symbol} · pool ${o.poolId}`}</h3>
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
              <dt className="text-muted-foreground">Funding deadline</dt>
              <dd className="font-medium">{formatDateUtc(o.maturityTs)}</dd>
              <dd className="text-xs text-muted-foreground">{o.settlementMode === "Hybrid" ? `Maturity. An unfunded buyback lapses into delivery after ${formatDateUtc(o.lapseTs)}` : "Maturity"}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Buyback funding</dt>
              <dd className="font-medium">{o.effectiveElection === "Delivery" ? "Not needed: grain delivery" : BigInt(o.buybackShortfall) === 0n ? "Funded" : `Short by ${formatUsdDown(o.buybackShortfall)}`}</dd>
              <dd className="text-xs text-muted-foreground">{`Vault holds ${formatUsd(o.vaultBalance)}`}</dd>
            </div>
          </dl>
          {o.settlementLabel ? <p className="text-sm text-muted-foreground">{o.settlementLabel}</p> : null}
          {o.settlementMode ? <ObligationActions item={o} /> : null}
        </section>
      ))}
    </div>
  );
}
