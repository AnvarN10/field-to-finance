import type { FeeStatus } from "../../lib/chain/views";
import { formatUsd, formatYield } from "../../lib/format";
import { ExplorerLink } from "../explorer-link";

/** Below this the sponsor can fund only a handful of new Instrument accounts (~0.002 SOL rent each). */
export const SPONSOR_LOW_LAMPORTS = 100_000_000;

const sol = (lamports: number) => `${(lamports / 1e9).toFixed(2)} SOL`;

/** ADR 0013: FeeConfig, treasury balance and the gas sponsor's balance for the demo console. */
export function FeesPanel({
  fees,
  sponsor,
  expectedTreasury,
  cluster = "devnet",
}: {
  fees: FeeStatus | null;
  sponsor: { address: string; lamports: number } | null;
  expectedTreasury: string | undefined;
  cluster?: string;
}) {
  const problems = [
    fees && expectedTreasury && expectedTreasury !== fees.treasury
      ? `F2F_TREASURY in this deployment is ${expectedTreasury}, but FeeConfig.treasury on devnet is ${fees.treasury}.`
      : null,
    sponsor && sponsor.lamports < SPONSOR_LOW_LAMPORTS ? `Gas sponsor is low on SOL (${sol(sponsor.lamports)}); top it up from the deployer.` : null,
  ].filter((p): p is string => p !== null);
  const row = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-2 last:border-0";
  return (
    <section aria-labelledby="fees-title" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <h2 id="fees-title" className="text-xl font-semibold">
        Platform fees
      </h2>
      {problems.length ? (
        <div role="alert" className="rounded-md border border-destructive p-3 text-sm">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      ) : null}
      {fees ? (
        <dl className="tabular flex flex-col text-sm">
          <div className={row}>
            <dt className="text-muted-foreground">Network fee (investor)</dt>
            <dd>{`${formatUsd(fees.networkFee)} per subscription`}</dd>
          </div>
          <div className={row}>
            <dt className="text-muted-foreground">Mint fee (farmer)</dt>
            <dd>{`${formatUsd(fees.mintFee)} per project`}</dd>
          </div>
          <div className={row}>
            <dt className="text-muted-foreground">Arrangement fee cap</dt>
            <dd>{formatYield(fees.maxArrangementBps)}</dd>
          </div>
          <div className={row}>
            <dt className="text-muted-foreground">Treasury</dt>
            <dd>
              <ExplorerLink kind="address" value={fees.treasury} cluster={cluster} />
            </dd>
          </div>
          <div className={row}>
            <dt className="text-muted-foreground">Treasury USDC</dt>
            <dd className="font-medium text-primary">{formatUsd(fees.treasuryUsdc)}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">FeeConfig is not initialized on devnet: no fees are charged. Run scripts/devnet-init-fees.ts.</p>
      )}
      {sponsor ? (
        <dl className="tabular flex flex-col text-sm">
          <div className={row}>
            <dt className="text-muted-foreground">Gas sponsor</dt>
            <dd>
              <ExplorerLink kind="address" value={sponsor.address} cluster={cluster} />
            </dd>
          </div>
          <div className={row}>
            <dt className="text-muted-foreground">Gas sponsor SOL</dt>
            <dd>{sol(sponsor.lamports)}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">F2F_SPONSOR_KEYPAIR is not set: user transactions cannot be sponsored.</p>
      )}
    </section>
  );
}
