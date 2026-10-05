import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardServiceCabinet } from "@/components/cabinet/guard";
import { Section, textLink } from "@/components/cabinet/section";
import { EventsTable, HoldersTable, RegistryTable } from "@/components/regulator/tables";
import { REGULATOR_TABS } from "@/components/regulator/tabs";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { regulatorData, regulatorEvents } from "@/lib/server/regulator-data";

export const metadata: Metadata = { title: "Pool registry entry", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RegulatorPool({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const g = await guardServiceCabinet(["regulator"], `/regulator/pools/${poolId}`);
  if ("element" in g) return g.element;
  if (!/^\d{1,20}$/.test(poolId)) notFound();
  let data, events;
  try {
    const db = await getDb();
    data = await regulatorData(db, { poolId });
    events = await regulatorEvents(db, poolId);
  } catch {
    return <ErrorState level={1} title="This entry is unavailable" body="Pools or accounts did not answer. Try again in a minute." retryHref={`/regulator/pools/${poolId}`} />;
  }
  const entry = data.registry[0];
  if (!entry) notFound();
  return (
    <CabinetShell role="Regulator" title={`${entry.symbol} · pool ${poolId}`} email={g.user.email} tabs={REGULATOR_TABS}>
      <Link href="/regulator" className={`${textLink} -mt-4 self-start text-sm`}>
        Back to the registry
      </Link>
      <RegistryTable rows={[entry]} />
      <Section title={`Holders (${data.holders.length})`} action={<a href={`/api/regulator/export?kind=holders&pool=${poolId}`} className={`${textLink} text-sm`}>Holders CSV</a>}>
        <HoldersTable rows={data.holders} />
      </Section>
      <Section title="Events" action={<a href={`/api/regulator/export?kind=events&pool=${poolId}`} className={`${textLink} text-sm`}>Events CSV</a>}>
        <EventsTable rows={events.slice(0, 200)} />
      </Section>
    </CabinetShell>
  );
}
