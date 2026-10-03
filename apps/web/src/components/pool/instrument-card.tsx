import type { ReactNode } from "react";
import type { PoolDetail } from "../../lib/chain/views";
import { formatDateUtc, formatUsd, formatYield, relativeTime } from "../../lib/format";
import { payoutPer, termDays } from "../../lib/pool-math";
import { ExplorerLink } from "../explorer-link";
import { ScasStubBadge } from "../scas-stub-badge";
import { PoolStatusBadge } from "../status-badge";
import { FundingMeter } from "./funding-meter";
import { ProjectsTable } from "./projects-table";

function Row({ title, children, stacked = false }: { title: string; children: ReactNode; stacked?: boolean }) {
  return (
    <section className={`grid gap-2 border-b border-border py-5 last:border-0 ${stacked ? "" : "sm:grid-cols-[180px_1fr]"}`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="flex min-w-0 flex-col gap-2 text-sm">{children}</div>
    </section>
  );
}

export function InstrumentCard({ detail, cluster = "devnet" }: { detail: PoolDetail; cluster?: string }) {
  const { pool, projects } = detail;
  const fields = projects.flatMap((p) => p.fields);
  const verified = projects.reduce((n, p) => n + p.verifiedFieldCount, 0);
  const total = projects.reduce((n, p) => n + p.fieldCount, 0);
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-6 sm:p-8">
      <Row title="Status">
        <div>
          <PoolStatusBadge status={pool.status} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Pool</dt>
          <dd>
            <ExplorerLink kind="address" value={pool.address} cluster={cluster} />
          </dd>
          <dt className="text-muted-foreground">Instrument mint</dt>
          <dd>
            <ExplorerLink kind="address" value={pool.mint} cluster={cluster} />
          </dd>
          <dt className="text-muted-foreground">USDC vault</dt>
          <dd>
            <ExplorerLink kind="address" value={pool.vault} cluster={cluster} />
          </dd>
        </dl>
      </Row>
      <Row title="Issuer">
        <p>
          Demo Issuer key <ExplorerLink kind="address" value={pool.issuer} cluster={cluster} />. The Issuer carries the obligation to pay principal plus the fixed yield at maturity.
        </p>
      </Row>
      <Row title="Farm Projects" stacked>
        <ProjectsTable projects={projects} />
      </Row>
      <Row title="SCAS checks">
        <p className="tabular">{`${verified} of ${total} fields verified`}</p>
        <div>
          <ScasStubBadge />
        </div>
        <p className="text-muted-foreground">{fields.length ? "Open a field to see its attestation timeline and evidence." : "No fields yet."}</p>
      </Row>
      <Row title="Amount">
        <FundingMeter raised={pool.raisedAmount} target={pool.targetAmount} />
      </Row>
      <Row title="Term">
        <dl className="tabular grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Subscription closes</dt>
          <dd>
            {formatDateUtc(pool.subscriptionCloseTs)} <span className="text-muted-foreground">({relativeTime(pool.subscriptionCloseTs)})</span>
          </dd>
          <dt className="text-muted-foreground">Maturity</dt>
          <dd>
            {formatDateUtc(pool.maturityTs)} <span className="text-muted-foreground">({relativeTime(pool.maturityTs)})</span>
          </dd>
          <dt className="text-muted-foreground">Term</dt>
          <dd>{termDays(pool) >= 1 ? `${termDays(pool)} days` : "Under a day (devnet demo)"}</dd>
        </dl>
      </Row>
      <Row title="Fixed yield">
        <p className="text-base font-semibold text-gold-text">Fixed yield {formatYield(pool.yieldBps)}</p>
        <p className="tabular">{`${formatUsd(payoutPer(pool, 1_000_000_000n))} back for every ${formatUsd(1_000_000_000n)}`}</p>
        <p className="text-muted-foreground">The same for every investor, whichever Shortfall rule settles a project.</p>
      </Row>
      <Row title="Shortfall rules">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Volume shortfall: the Producer covers the missing tonnes from other fields.</li>
          <li>Quality shortfall: the Producer buys grain of the contracted class on the market.</li>
          <li>{`No such grain on the market: the Producer repays in USD with a ${formatYield(pool.premiumBps)} premium.`}</li>
        </ol>
        <p className="text-muted-foreground">Only 30% of each project&apos;s expected harvest backs the Instrument.</p>
      </Row>
      <Row title="Risks">
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Issuer credit risk: payout depends on the Issuer funding redemption.</li>
          <li>Field checks come from a SCAS stub until the external provider is integrated.</li>
          <li>The Pool holds freeze authority over Instrument accounts and can freeze an account for compliance reasons.</li>
          <li>Devnet demo with test USDC. Nothing here is an offer of securities.</li>
        </ul>
      </Row>
    </div>
  );
}
