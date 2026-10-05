import type { Metadata } from "next";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { OnboardingSteps } from "@/components/investor/onboarding-steps";
import { INVESTOR_TABS } from "@/components/investor/tabs";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { investorOnboarding } from "@/lib/workflow/investor";

export const metadata: Metadata = { title: "Investor onboarding", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvestorOnboardingPage() {
  const g = await guardCabinet("investor", "/investor/onboarding");
  if ("element" in g) return g.element;
  let state;
  try {
    state = await investorOnboarding(await getDb(), g.user.id);
  } catch {
    return <ErrorState level={1} title="Your cabinet is unavailable" body="Your onboarding could not be loaded. Try again in a minute." retryHref="/investor/onboarding" />;
  }
  return (
    <CabinetShell role="Investor" title="Onboarding" email={g.user.email} tabs={INVESTOR_TABS}>
      <OnboardingSteps userId={g.user.id} state={state} />
    </CabinetShell>
  );
}
