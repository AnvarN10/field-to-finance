import type { Metadata } from "next";
import { HistoryTable } from "@/components/cabinet/history-table";
import { Section } from "@/components/cabinet/section";
import { Obligations } from "@/components/farmer/obligations";
import { guardAccount } from "@/components/shell/account-guard";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { issuerObligations } from "@/lib/server/issuer-data";
import { refreshStatuses } from "@/lib/server/status-refresh";
import { farmerApplications } from "@/lib/workflow/farmer";

export const metadata: Metadata = { title: "Obligations" };
export const dynamic = "force-dynamic";

export default async function IssuerObligations() {
  const g = await guardAccount("farmer", "/issuer/obligations");
  if ("element" in g) return g.element;
  let data;
  try {
    const db = await getDb();
    await refreshStatuses(db);
    data = await issuerObligations(db, g.user.id, await farmerApplications(db, g.user.id), Math.floor(Date.now() / 1000));
  } catch {
    return <ErrorState level={1} title="Your workspace is unavailable" body="Your obligations could not be loaded. Try again in a minute." retryHref="/issuer/obligations" />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Obligations" description="What your company owes holders. Coupon accrues Act/360 from the interest start; the buyback needs the full amount in the vault by maturity." />
      {data.obligations.length ? (
        <Obligations items={data.obligations} />
      ) : (
        <EmptyState title="No obligations yet" body="Once a pool built from your application is funded, the amount due, the maturity and the settlement election appear here." />
      )}
      <Section title="Payouts and fees">
        <HistoryTable rows={data.history} empty="No payouts yet. Proceeds arrive in your wallet when the arranger disburses a funded pool." cluster={serverEnv().SOLANA_CLUSTER} />
      </Section>
    </div>
  );
}
