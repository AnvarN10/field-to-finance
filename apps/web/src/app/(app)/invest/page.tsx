import type { Metadata } from "next";
import Link from "next/link";
import { KycStatusBadge } from "@/components/cabinet/badges";
import { Panel, primaryLink, Section, textLink } from "@/components/cabinet/section";
import { Updates } from "@/components/cabinet/updates";
import { guardAccount } from "@/components/shell/account-guard";
import { PageHeader } from "@/components/shell/page-header";
import { ErrorState } from "@/components/state";
import { formatDateUtc, formatUsd, formatUsdDown } from "@/lib/format";
import { summarize } from "@/lib/invest-summary";
import { getDb } from "@/lib/server/db";
import { investorPortfolio } from "@/lib/server/investor-data";
import { investorOnboarding } from "@/lib/workflow/investor";
import { listNotifications } from "@/lib/workflow/notifications";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function InvestOverview() {
  const g = await guardAccount("investor", "/invest");
  if ("element" in g) return g.element;
  let data;
  try {
    const db = await getDb();
    const [onboarding, portfolio, updates] = await Promise.all([investorOnboarding(db, g.user.id), investorPortfolio(db, g.user), listNotifications(db, g.user.id, 5)]);
    data = { onboarding, portfolio, updates };
  } catch {
    return <ErrorState level={1} title="Your account is unavailable" body="Your portfolio could not be loaded. Try again in a minute." retryHref="/invest" />;
  }
  const { onboarding, portfolio } = data;
  const s = summarize(portfolio, Math.floor(Date.now() / 1000));
  const has = portfolio.positions.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Overview" />
      {!onboarding.complete ? (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">Verify your account to invest</h2>
              <p className="max-w-prose text-sm text-muted-foreground">Category, identity check, risk acknowledgement and a linked wallet. Compliance reviews your identity; then each pool asks you to read its key features once.</p>
            </div>
            <KycStatusBadge status={onboarding.kycStatus} />
          </div>
          <Link href="/invest/account" className={`${primaryLink} self-start`}>
            Continue verification
          </Link>
        </Panel>
      ) : null}

      <dl className="tabular grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">Value at maturity</dt>
          <dd className="text-xl font-semibold text-primary">{formatUsdDown(s.atMaturity)}</dd>
        </div>
        <div className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">Coupon accrued to date</dt>
          <dd className="text-xl font-semibold">{formatUsdDown(s.accrued)}</dd>
        </div>
        <div className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">Test USDC in linked wallets</dt>
          <dd className="text-xl font-semibold">{formatUsd(s.usdc)}</dd>
        </div>
        <div className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">Next payment</dt>
          <dd className="text-xl font-semibold">{s.next ? formatUsdDown(s.next.amount) : <span className="text-base font-normal text-muted-foreground">Not scheduled yet</span>}</dd>
          {s.next ? <dd className="text-xs text-muted-foreground">{formatDateUtc(s.next.ts)}</dd> : null}
        </div>
      </dl>

      {has ? (
        <Section title="Upcoming payments" description="Principal plus coupon per maturity date, before settlement." action={<Link href="/invest/portfolio" className={`${textLink} text-sm`}>Open portfolio</Link>}>
          {s.upcoming.length ? (
            <ul className="tabular flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-sm">
              {s.upcoming.slice(0, 5).map((u) => (
                <li key={u.ts} className="flex items-center justify-between gap-3 p-4">
                  <span>{formatDateUtc(u.ts)}</span>
                  <span className="font-medium">{formatUsdDown(u.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Every position has matured. Redeem or claim grain from your portfolio.</p>
          )}
        </Section>
      ) : (
        <Section title="No investments yet">
          <p className="max-w-prose text-sm text-muted-foreground">Browse the open pools, read a pool&apos;s key features and subscribe with USDC. Your positions and payments appear here.</p>
          <Link href="/invest/opportunities" className={`${textLink} self-start text-sm`}>
            See opportunities
          </Link>
        </Section>
      )}

      <Section title="Updates">
        <Updates items={data.updates} />
      </Section>
    </div>
  );
}
