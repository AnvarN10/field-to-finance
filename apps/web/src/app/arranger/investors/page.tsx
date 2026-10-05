import type { Metadata } from "next";
import { Decision } from "@/components/arranger/decision";
import { ARRANGER_TABS } from "@/components/arranger/tabs";
import { KycStatusBadge } from "@/components/cabinet/badges";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { Section } from "@/components/cabinet/section";
import { ErrorState } from "@/components/state";
import { shortKey } from "@/lib/format";
import { getDb } from "@/lib/server/db";
import { investorQueue, type InvestorQueueRow } from "@/lib/workflow/arranger";
import { RETAIL_LIMITS } from "@/lib/workflow/investor";
import { decideInvestorKycAction } from "../workflow-actions";

export const metadata: Metadata = { title: "Investor KYC", robots: { index: false } };
export const dynamic = "force-dynamic";

const NET: Record<string, string> = { "under-100k": "Under USD 100,000", "100k-1m": "USD 100,000 to 1M", "1m-10m": "USD 1M to 10M", "over-10m": "Over USD 10M" };
const EXPERIENCE: Record<string, string> = { none: "None", some: "Some", extensive: "Extensive" };
const CATEGORY: Record<string, string> = { professional: "Professional", retail: "Retail", institutional: "Institutional" };

function InvestorCard({ r, decide }: { r: InvestorQueueRow; decide: boolean }) {
  const q = r.profile.questionnaire as { answers?: { netAssets?: string; experience?: string; basis?: string }; kyc?: { fullName?: string; country?: string } };
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium break-all">{r.email}</span>
        <KycStatusBadge status={r.profile.kycStatus} />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {[
          ["Category", r.profile.category ? CATEGORY[r.profile.category] : "Not answered"],
          ["Net assets", NET[q.answers?.netAssets ?? ""] ?? "Not answered"],
          ["Experience", EXPERIENCE[q.answers?.experience ?? ""] ?? q.answers?.experience ?? "Not answered"],
          ["Why they qualify", q.answers?.basis ?? "Not given"],
          ["Full name", q.kyc?.fullName ?? "Not given"],
          ["Country", q.kyc?.country ?? "Not given"],
          ["Risk acknowledgement", r.profile.riskAckAt ? "Given" : "Not yet"],
          ["Wallets", r.wallets.length ? r.wallets.map(shortKey).join(", ") : "None linked yet: approval applies when one is linked"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {r.profile.category === "retail" ? <p className="rounded-md bg-muted p-3 text-sm">{RETAIL_LIMITS}</p> : null}
      {r.profile.kycNote ? <p className="text-sm text-muted-foreground">{`Note: ${r.profile.kycNote}`}</p> : null}
      {decide ? (
        <Decision approveLabel="Approve KYC" approve={decideInvestorKycAction.bind(null, r.userId, "approved", null)} reject={decideInvestorKycAction.bind(null, r.userId, "rejected")} signedBy="Compliance" />
      ) : null}
    </li>
  );
}

export default async function InvestorKycPage() {
  const g = await guardCabinet("arranger", "/arranger/investors");
  if ("element" in g) return g.element;
  let pending, decided;
  try {
    const db = await getDb();
    [pending, decided] = await Promise.all([investorQueue(db, ["pending"]), investorQueue(db, ["approved", "rejected"])]);
  } catch {
    return <ErrorState level={1} title="Your cabinet is unavailable" body="The KYC queue could not be loaded. Try again in a minute." retryHref="/arranger/investors" />;
  }
  return (
    <CabinetShell role="Arranger" title="Investor KYC" email={g.user.email} tabs={ARRANGER_TABS}>
      <Section title="Waiting for a decision" description="Check the category against the answers. Approval writes the platform KYC record on-chain for every linked wallet.">
        {pending.length ? (
          <ul className="grid gap-4 xl:grid-cols-2">
            {pending.map((r) => (
              <InvestorCard key={r.userId} r={r} decide />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No investor is waiting.</p>
        )}
      </Section>
      <Section title="Decided">
        {decided.length ? (
          <ul className="grid gap-4 xl:grid-cols-2">
            {decided.slice(0, 20).map((r) => (
              <InvestorCard key={r.userId} r={r} decide={false} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No decisions yet.</p>
        )}
      </Section>
    </CabinetShell>
  );
}
