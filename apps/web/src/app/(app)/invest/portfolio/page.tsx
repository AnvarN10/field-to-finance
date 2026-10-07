import type { Metadata } from "next";
import { Section } from "@/components/cabinet/section";
import { GrainClaims } from "@/components/investor/grain-claims";
import { Positions } from "@/components/investor/positions";
import { guardAccount } from "@/components/shell/account-guard";
import { PageHeader } from "@/components/shell/page-header";
import { ErrorState } from "@/components/state";
import { FaucetButton } from "@/components/wallet/faucet-button";
import { formatDateUtc, formatUsdDown, shortKey } from "@/lib/format";
import { summarize } from "@/lib/invest-summary";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { investorPortfolio } from "@/lib/server/investor-data";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function InvestPortfolio() {
  const g = await guardAccount("investor", "/invest/portfolio");
  if ("element" in g) return g.element;
  let portfolio;
  try {
    portfolio = await investorPortfolio(await getDb(), g.user);
  } catch {
    return <ErrorState level={1} title="Your account is unavailable" body="Your portfolio could not be loaded. Try again in a minute." retryHref="/invest/portfolio" />;
  }
  const s = summarize(portfolio, Math.floor(Date.now() / 1000));
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Portfolio" description="Positions across your linked wallets, valued with the coupon accrued Act/360." />
      <Section title="Positions">
        <Positions rows={portfolio.positions} />
      </Section>

      {s.upcoming.length ? (
        <Section title="Maturity schedule">
          <ul className="tabular flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {s.upcoming.map((u) => (
              <li key={u.ts} className="flex items-center justify-between gap-3 p-4">
                <span>{formatDateUtc(u.ts)}</span>
                <span className="font-medium">{formatUsdDown(u.amount)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {portfolio.claims.length ? (
        <Section title="Grain claims" description="Certificates for tokens burned for grain at the elevator.">
          <GrainClaims claims={portfolio.claims} cluster={serverEnv().SOLANA_CLUSTER} />
        </Section>
      ) : null}

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
    </div>
  );
}
