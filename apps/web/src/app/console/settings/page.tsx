import type { Metadata } from "next";
import { FeesPanel } from "@/components/admin/fees-panel";
import { MintUsdcForm } from "@/components/admin/mint-usdc-form";
import { KeyAlerts } from "@/components/arranger/key-alerts";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { Panel, Section } from "@/components/cabinet/section";
import { ErrorState } from "@/components/state";
import { treasuryData } from "@/lib/server/console-data";
import { serverEnv } from "@/lib/server/env";

export const metadata: Metadata = { title: "Fees and treasury" };
export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  const g = await guardConsole("settings.manage", "/console/settings");
  if ("element" in g) return g.element;
  let data;
  try {
    data = await treasuryData();
  } catch {
    return <ErrorState level={1} title="Could not load devnet state" body="Solana devnet did not answer." retryHref="/console/settings" />;
  }
  const env = serverEnv();
  return (
    <ConsolePage title="Fees and treasury">
      <KeyAlerts keyProblems={data.keyProblems} mismatches={data.mismatches} />
      <FeesPanel fees={data.fees} sponsor={data.sponsor} expectedTreasury={env.F2F_TREASURY} cluster={env.SOLANA_CLUSTER} />
      <Section title="Test USDC for demo investors" description="Tokens are $100,000 each, beyond the public faucet. Mints devnet test USDC only.">
        <Panel className="max-w-3xl">
          <MintUsdcForm />
        </Panel>
      </Section>
    </ConsolePage>
  );
}
