import type { Metadata } from "next";
import { HistoryTable } from "@/components/cabinet/history-table";
import { textLink } from "@/components/cabinet/section";
import { guardAccount } from "@/components/shell/account-guard";
import { PageHeader } from "@/components/shell/page-header";
import { ErrorState } from "@/components/state";
import { formatUsd } from "@/lib/format";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { investorPortfolio } from "@/lib/server/investor-data";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default async function InvestActivity() {
  const g = await guardAccount("investor", "/invest/activity");
  if ("element" in g) return g.element;
  let portfolio;
  try {
    portfolio = await investorPortfolio(await getDb(), g.user);
  } catch {
    return <ErrorState level={1} title="Your account is unavailable" body="Your activity could not be loaded. Try again in a minute." retryHref="/invest/activity" />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader
        title="Activity"
        description="Subscriptions, refunds, redemptions and grain claims, each with its transaction."
        action={
          <a href="/api/investor/statement" className={`${textLink} text-sm`}>
            Download statement (CSV)
          </a>
        }
      />
      <HistoryTable
        rows={portfolio.history.map((h) => ({ id: h.id, at: h.at, label: `${h.label} · ${h.pool}`, amount: h.amount ? formatUsd(h.amount) : null, signature: h.signature }))}
        empty="No transactions yet. Subscriptions, refunds, redemptions and grain claims appear here."
        cluster={serverEnv().SOLANA_CLUSTER}
      />
    </div>
  );
}
