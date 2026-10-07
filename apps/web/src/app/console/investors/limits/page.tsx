import type { Metadata } from "next";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { INVESTOR_TABS } from "@/components/console/sub-tabs";
import { Section } from "@/components/cabinet/section";
import { RetailMonitorTable } from "@/components/compliance/retail-monitor";
import { ErrorState } from "@/components/state";
import { getReader } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import { retailMonitor } from "@/lib/workflow/compliance";

export const metadata: Metadata = { title: "Retail limits" };
export const dynamic = "force-dynamic";

export default async function RetailLimits() {
  const g = await guardConsole("investors.view", "/console/investors/limits");
  if ("element" in g) return g.element;
  let rows;
  try {
    const pools = (await getReader().listPools()).filter((p) => p.status !== "Draft");
    const m = await retailMonitor(await getDb(), pools.map((p) => ({ address: p.address, poolId: p.poolId, symbol: p.instrument?.symbol ?? `POOL-${p.poolId}` })));
    rows = m.filter((r) => r.investors.length).map((r) => ({ ...r, retailTotal: r.retailTotal.toString(), totalCap: r.totalCap.toString(), investors: r.investors.map((i) => ({ ...i, amount: i.amount.toString() })) }));
  } catch {
    return <ErrorState level={1} title="Could not load the limits" body="Pools or accounts did not answer. Try again in a minute." retryHref="/console/investors/limits" />;
  }
  return (
    <ConsolePage title="Retail limits" tabs={INVESTOR_TABS}>
      <Section title="Exempt-offer monitor" description="AIFC exempt offer: fewer than 50 retail investors in 12 months, at least USD 100,000 each, up to USD 5M from retail. Counted from confirmed subscriptions.">
        <RetailMonitorTable rows={rows} />
      </Section>
    </ConsolePage>
  );
}
