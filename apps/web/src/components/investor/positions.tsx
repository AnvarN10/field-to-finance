import Link from "next/link";
import { formatDateUtc, formatTonnes, formatUsd, formatUsdDown, shortKey } from "../../lib/format";
import { textLink } from "../cabinet/section";
import { EmptyState } from "../state";

export type PositionRow = {
  poolId: string;
  symbol: string;
  wallet: string;
  /** Whole tokens for term-sheet pools, null for flat-yield pools. */
  tokens: string | null;
  holding: string;
  accrued: string | null;
  atMaturity: string;
  maturityTs: number;
  settlement: string;
  grainClaimKg: string | null;
  action: "View pool" | "Redeem" | "Refund" | "Claim grain";
};

export function Positions({ rows }: { rows: PositionRow[] }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="No positions yet"
        body="Accept a pool's key features document, then subscribe on the pool page with a linked wallet."
        action={
          <Link href="/pools" className={textLink}>
            Browse pools
          </Link>
        }
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card" role="region" aria-label="Positions" tabIndex={0}>
      <table className="tabular w-full text-sm whitespace-nowrap">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Instrument</th>
            <th className="px-3 py-2 text-right font-medium">Tokens</th>
            <th className="px-3 py-2 text-right font-medium">Nominal</th>
            <th className="px-3 py-2 text-right font-medium">Accrued coupon</th>
            <th className="px-3 py-2 text-right font-medium">At maturity</th>
            <th className="px-3 py-2 font-medium">Maturity</th>
            <th className="px-3 py-2 font-medium">Settlement</th>
            <th className="px-3 py-2 text-right font-medium">Grain claim</th>
            <th className="px-3 py-2 font-medium">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.poolId}-${r.wallet}`} className="border-t border-border first:border-t-0">
              <td className="px-3 py-3">
                <div className="flex flex-col">
                  <span className="font-medium">{r.symbol}</span>
                  <span className="font-mono text-xs text-muted-foreground">{shortKey(r.wallet)}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-right">{r.tokens ?? "–"}</td>
              <td className="px-3 py-3 text-right">{formatUsd(r.holding)}</td>
              <td className="px-3 py-3 text-right">{r.accrued !== null ? formatUsdDown(r.accrued) : "–"}</td>
              <td className="px-3 py-3 text-right font-medium">{formatUsdDown(r.atMaturity)}</td>
              <td className="px-3 py-3">{formatDateUtc(r.maturityTs)}</td>
              <td className="max-w-72 px-3 py-3 whitespace-normal text-muted-foreground">{r.settlement}</td>
              <td className="px-3 py-3 text-right">{r.grainClaimKg ? formatTonnes(r.grainClaimKg) : "–"}</td>
              <td className="px-3 py-3 text-right">
                <Link href={r.action === "View pool" ? `/pools/${r.poolId}` : `/pools/${r.poolId}#invest`} className={textLink} aria-label={`${r.action} ${r.symbol}`}>
                  {r.action}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
