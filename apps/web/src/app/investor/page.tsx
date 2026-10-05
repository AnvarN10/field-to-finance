import type { Metadata } from "next";
import Link from "next/link";
import { KycStatusBadge } from "@/components/cabinet/badges";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { HistoryTable } from "@/components/cabinet/history-table";
import { Panel, primaryLink, Section, textLink } from "@/components/cabinet/section";
import { Updates } from "@/components/cabinet/updates";
import { GrainClaims } from "@/components/investor/grain-claims";
import { Positions } from "@/components/investor/positions";
import { INVESTOR_TABS } from "@/components/investor/tabs";
import { ErrorState } from "@/components/state";
import { FaucetButton } from "@/components/wallet/faucet-button";
import { formatDateUtc, formatUsd, formatUsdDown, shortKey } from "@/lib/format";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { investorPortfolio } from "@/lib/server/investor-data";
import { investorOnboarding } from "@/lib/workflow/investor";
import { listNotifications } from "@/lib/workflow/notifications";

export const metadata: Metadata = { title: "Investor cabinet", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvestorHome() {
  const g = await guardCabinet("investor", "/investor");
  if ("element" in g) return g.element;
  let data;
  try {
    const db = await getDb();
    const [onboarding, portfolio, updates] = await Promise.all([investorOnboarding(db, g.user.id), investorPortfolio(db, g.user), listNotifications(db, g.user.id, 5)]);
    data = { onboarding, portfolio, updates };
  } catch {
    return <ErrorState level={1} title="Your cabinet is unavailable" body="Your portfolio could not be loaded. Try again in a minute." retryHref="/investor" />;
  }
  const { onboarding, portfolio } = data;
  const usdc = portfolio.states.reduce((s, x) => s + BigInt(x?.usdcBalance ?? "0"), 0n);
  const schedule = [...portfolio.positions.reduce((m, r) => m.set(r.maturityTs, (m.get(r.maturityTs) ?? 0n) + BigInt(r.atMaturity)), new Map<number, bigint>())].sort((a, b) => a[0] - b[0]);
  const cluster = serverEnv().SOLANA_CLUSTER;

  return (
    <CabinetShell role="Investor" title="Portfolio" email={g.user.email} tabs={INVESTOR_TABS}>
      {!onboarding.complete ? (
        <Panel>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Finish onboarding to subscribe</h2>
            <p className="text-sm text-muted-foreground">Category, identity check, risk acknowledgement and a linked wallet. An arranger approves your KYC; then each pool asks you to accept its key features once.</p>
          </div>
          <Link href="/investor/onboarding" className={`${primaryLink} self-start`}>
            Continue onboarding
          </Link>
        </Panel>
      ) : null}

      <dl className="tabular grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">Test USDC in linked wallets</dt>
          <dd className="text-xl font-semibold">{formatUsd(usdc)}</dd>
        </div>
        <div className="flex flex-col items-start gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">KYC</dt>
          <dd>
            <KycStatusBadge status={onboarding.kycStatus} />
          </dd>
        </div>
        <div className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">Positions</dt>
          <dd className="text-xl font-semibold">{portfolio.positions.length}</dd>
        </div>
        <div className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">Next maturity</dt>
          <dd className="text-xl font-semibold text-primary">{schedule[0] ? formatUsdDown(schedule[0][1]) : "–"}</dd>
          {schedule[0] ? <dd className="text-xs text-muted-foreground">{formatDateUtc(schedule[0][0])}</dd> : null}
        </div>
      </dl>

      <Section
        title="Positions"
        action={
          <a href="/api/investor/statement" className={`${textLink} text-sm`}>
            Download statement (CSV)
          </a>
        }
      >
        <Positions rows={portfolio.positions} />
      </Section>

      {schedule.length ? (
        <Section title="Maturity schedule">
          <ul className="tabular flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {schedule.map(([ts, due]) => (
              <li key={ts} className="flex items-center justify-between gap-3 p-4">
                <span>{formatDateUtc(ts)}</span>
                <span className="font-medium">{formatUsdDown(due)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {portfolio.claims.length ? (
        <Section title="Grain claims" description="Certificates for tokens burned for grain at the elevator.">
          <GrainClaims claims={portfolio.claims} cluster={cluster} />
        </Section>
      ) : null}

      <Section title="History">
        <HistoryTable
          rows={portfolio.history.map((h) => ({ id: h.id, at: h.at, label: `${h.label} · ${h.pool}`, amount: h.amount ? formatUsd(h.amount) : null, signature: h.signature }))}
          empty="No transactions yet. Subscriptions, refunds, redemptions and grain claims appear here."
          cluster={cluster}
        />
      </Section>

      {portfolio.wallets.length ? (
        <Section title="Test funds" description="Devnet only. Each linked wallet can get test USDC to subscribe.">
          <div className="flex flex-wrap gap-6">
            {portfolio.wallets.map((w) => (
              <div key={w.address} className="flex flex-col gap-2 text-sm">
                <span className="font-mono text-muted-foreground">{shortKey(w.address)}</span>
                <FaucetButton wallet={w.address} usdc />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Updates">
        <Updates items={data.updates} />
      </Section>
    </CabinetShell>
  );
}
