import type { Metadata } from "next";
import { FeesPanel } from "@/components/admin/fees-panel";
import { MintUsdcForm } from "@/components/admin/mint-usdc-form";
import { KeyAlerts } from "@/components/arranger/key-alerts";
import { ARRANGER_TABS } from "@/components/arranger/tabs";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { Panel, Section } from "@/components/cabinet/section";
import { ErrorState } from "@/components/state";
import { consoleData } from "@/lib/server/console-data";
import { serverEnv } from "@/lib/server/env";

export const metadata: Metadata = { title: "Fees and treasury", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  const g = await guardCabinet("arranger", "/arranger/treasury");
  if ("element" in g) return g.element;
  let data;
  try {
    data = await consoleData();
  } catch {
    return <ErrorState level={1} title="Could not load devnet state" body="Solana devnet did not answer." retryHref="/arranger/treasury" />;
  }
  const env = serverEnv();
  return (
    <CabinetShell role="Arranger" title="Fees and treasury" email={g.user.email} tabs={ARRANGER_TABS}>
      <KeyAlerts keyProblems={data.keyProblems} mismatches={data.mismatches} />
      <FeesPanel fees={data.fees} sponsor={data.sponsor} expectedTreasury={env.F2F_TREASURY} cluster={env.SOLANA_CLUSTER} />
      <Section title="Test USDC for demo investors" description="Tokens are $100,000 each, beyond the public faucet. Mints devnet test USDC only.">
        <Panel className="max-w-3xl">
          <MintUsdcForm />
        </Panel>
      </Section>
    </CabinetShell>
  );
}
