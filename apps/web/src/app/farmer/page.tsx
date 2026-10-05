import type { Metadata } from "next";
import Link from "next/link";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { HistoryTable, type HistoryRow } from "@/components/cabinet/history-table";
import { Panel, primaryLink, Section, textLink } from "@/components/cabinet/section";
import { Updates } from "@/components/cabinet/updates";
import { KycStatusBadge } from "@/components/cabinet/badges";
import { ApplicationList } from "@/components/farmer/application-list";
import { Obligations, type ObligationItem } from "@/components/farmer/obligations";
import { FARMER_TABS } from "@/components/farmer/tabs";
import { ErrorState } from "@/components/state";
import { formatUsd } from "@/lib/format";
import { arrangerChain } from "@/lib/server/chain-port";
import { farmerHistory, poolObligation } from "@/lib/server/cabinet-data";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { refreshChainStatuses } from "@/lib/workflow/arranger";
import { farmerApplications, farmerProfile, isProfileComplete } from "@/lib/workflow/farmer";
import { listNotifications } from "@/lib/workflow/notifications";

export const metadata: Metadata = { title: "Farmer cabinet", robots: { index: false } };
export const dynamic = "force-dynamic";

const TX_LABEL: Record<string, string> = {
  "tx.register-project": "Fields registered on-chain",
  "pool.open": "Pool opened to investors",
  "pool.close_subscription": "Subscription closed",
  "pool.fund_redemption": "Redemption funded",
  "pool.elect_settlement": "Settlement elected",
  "pool.record_delivery": "Delivery document recorded",
  "pool.sweep": "Vault remainder returned",
};

export default async function FarmerHome() {
  const g = await guardCabinet("farmer", "/farmer");
  if ("element" in g) return g.element;
  const { user } = g;
  const now = Math.floor(Date.now() / 1000);
  let data;
  try {
    const db = await getDb();
    await refreshChainStatuses(db, arrangerChain(), now).catch(() => 0);
    const [profile, apps, updates] = await Promise.all([farmerProfile(db, user.id), farmerApplications(db, user.id), listNotifications(db, user.id, 5)]);
    const pooled = apps.filter((a) => a.poolId);
    const obligations = (await Promise.all(pooled.map((a) => poolObligation(a.poolId as string, now)))).map((o, i) => (o ? { ...o, app: pooled[i]! } : null)).filter((o) => o !== null);
    const history = await farmerHistory(db, user.id, pooled.map((a) => a.poolId as string));
    data = { profile, apps, updates, obligations, history };
  } catch {
    return <ErrorState level={1} title="Your cabinet is unavailable" body="Your applications could not be loaded. Try again in a minute." retryHref="/farmer" />;
  }
  const complete = isProfileComplete(data.profile);
  const kyc = data.profile?.kycStatus ?? "not_started";
  const feeByPool = new Map(data.obligations.map((o) => [o.app.poolId as string, { fee: o.detail.arrangementFeeBps, requested: BigInt(o.app.requestedUsd) * 1_000_000n }]));
  const history: HistoryRow[] = data.history.flatMap((h): HistoryRow[] => {
    if (h.action === "pool.disburse") {
      const p = feeByPool.get(h.targetId);
      const fee = p ? (p.requested * BigInt(p.fee)) / 10_000n : null;
      return [
        { id: `${h.id}-pay`, at: h.createdAt, label: "Proceeds paid to your wallet", amount: p && fee !== null ? formatUsd(p.requested - fee) : null, signature: h.txSignature },
        ...(p && fee ? [{ id: `${h.id}-fee`, at: h.createdAt, label: "Arrangement fee withheld", amount: formatUsd(fee), signature: h.txSignature }] : []),
      ];
    }
    return [{ id: h.id, at: h.createdAt, label: TX_LABEL[h.action] ?? h.action, amount: null, signature: h.txSignature }];
  });
  const obligations: ObligationItem[] = data.obligations.map((o) => o.item);

  return (
    <CabinetShell role="Farmer issuer" title="Your financing" email={user.email} tabs={FARMER_TABS}>
      {!complete || kyc !== "approved" ? (
        <Panel>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Finish onboarding</h2>
            <p className="text-sm text-muted-foreground">Your company becomes the issuer of record of its pool. The arranger needs the profile and issuer KYC before structuring.</p>
          </div>
          <ol className="flex flex-col gap-2 text-sm">
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>1. Company profile</span>
              <span className={complete ? "text-success" : "text-muted-foreground"}>{complete ? "Done" : "To do"}</span>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>2. Issuer KYC</span>
              <KycStatusBadge status={kyc} />
            </li>
          </ol>
          <Link href="/farmer/onboarding" className={`${primaryLink} self-start`}>
            Continue onboarding
          </Link>
        </Panel>
      ) : null}

      <Section
        title="Applications"
        action={
          complete && data.apps.length ? (
            <Link href="/farmer/applications/new" className={primaryLink}>
              New application
            </Link>
          ) : undefined
        }
      >
        <ApplicationList applications={data.apps.slice(0, 5)} canCreate={complete} />
        {data.apps.length > 5 ? (
          <Link href="/farmer/applications" className={`${textLink} self-start text-sm`}>
            {`All ${data.apps.length} applications`}
          </Link>
        ) : null}
      </Section>

      {obligations.length ? (
        <Section title="Obligations" description="What your company owes holders. Coupon accrues Act/360 from the interest start; the buyback needs the full amount in the vault by maturity.">
          <Obligations items={obligations} />
        </Section>
      ) : null}

      <Section title="Payouts and fees">
        <HistoryTable rows={history} empty="No payouts yet. Proceeds arrive in your wallet when the arranger disburses a funded pool." cluster={serverEnv().SOLANA_CLUSTER} />
      </Section>

      <Section title="Updates">
        <Updates items={data.updates} />
      </Section>
    </CabinetShell>
  );
}
