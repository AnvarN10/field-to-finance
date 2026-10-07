import type { Metadata } from "next";
import { Decision } from "@/components/arranger/decision";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { INVESTOR_TABS } from "@/components/console/sub-tabs";
import { Section } from "@/components/cabinet/section";
import { InvestorCard } from "@/components/compliance/investor-card";
import { RevokeKyc } from "@/components/compliance/revoke-kyc";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { complianceQueues } from "@/lib/workflow/compliance";
import { decideInvestorKycAction, revokeInvestorKycAction } from "@/app/console/_actions/kyc";

export const metadata: Metadata = { title: "Investor KYC" };
export const dynamic = "force-dynamic";

export default async function ComplianceInvestors() {
  const g = await guardConsole("investors.view", "/console/investors");
  if ("element" in g) return g.element;
  let q;
  try {
    q = await complianceQueues(await getDb());
  } catch {
    return <ErrorState level={1} title="This section is unavailable" body="The KYC queues could not be loaded. Try again in a minute." retryHref="/console/investors" />;
  }
  return (
    <ConsolePage title="Investor KYC" tabs={INVESTOR_TABS}>
      <Section title="Waiting for a decision" description="Check the category against the answers. Approval writes the platform KYC record on-chain for every linked wallet.">
        {q.investors.length ? (
          <ul className="grid gap-4 xl:grid-cols-2">
            {q.investors.map((r) => (
              <InvestorCard key={r.userId} r={r}>
                <Decision approveLabel="Approve KYC" approve={decideInvestorKycAction.bind(null, r.userId, "approved", null)} reject={decideInvestorKycAction.bind(null, r.userId, "rejected")} signedBy="the compliance key" />
              </InvestorCard>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No investor is waiting.</p>
        )}
      </Section>
      <Section title="Approved" description="Revoking clears the on-chain approval of every linked wallet and freezes its holdings.">
        {q.approvedInvestors.length ? (
          <ul className="grid gap-4 xl:grid-cols-2">
            {q.approvedInvestors.map((r) => (
              <InvestorCard key={r.userId} r={r}>
                <RevokeKyc revoke={revokeInvestorKycAction.bind(null, r.userId)} />
              </InvestorCard>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No approved investors yet.</p>
        )}
      </Section>
    </ConsolePage>
  );
}
