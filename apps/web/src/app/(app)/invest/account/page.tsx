import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { guardAccount } from "@/components/shell/account-guard";
import { OnboardingSteps } from "@/components/investor/onboarding-steps";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { investorOnboarding } from "@/lib/workflow/investor";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function InvestorOnboardingPage() {
  const g = await guardAccount("investor", "/invest/account");
  if ("element" in g) return g.element;
  let state;
  try {
    state = await investorOnboarding(await getDb(), g.user.id);
  } catch {
    return <ErrorState level={1} title="Your account is unavailable" body="Your onboarding could not be loaded. Try again in a minute." retryHref="/invest/account" />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Account and verification" description="Verify your account to invest: category, identity check, risk acknowledgement and a linked wallet." />
      <OnboardingSteps userId={g.user.id} state={state} />
    </div>
  );
}
