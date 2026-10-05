import type { Metadata } from "next";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardServiceCabinet } from "@/components/cabinet/guard";
import { Section, textLink } from "@/components/cabinet/section";
import { EventsTable } from "@/components/regulator/tables";
import { REGULATOR_TABS } from "@/components/regulator/tabs";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { regulatorEvents } from "@/lib/server/regulator-data";

export const metadata: Metadata = { title: "Events", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RegulatorEvents() {
  const g = await guardServiceCabinet(["regulator"], "/regulator/events");
  if ("element" in g) return g.element;
  let events;
  try {
    events = await regulatorEvents(await getDb());
  } catch {
    return <ErrorState level={1} title="Events are unavailable" body="Accounts did not answer. Try again in a minute." retryHref="/regulator/events" />;
  }
  return (
    <CabinetShell role="Regulator" title="Events" email={g.user.email} tabs={REGULATOR_TABS}>
      <Section title="Platform events" description="The latest 1,000 decisions and on-chain actions, newest first, with the role that acted; a pool's page shows its whole history. Review notes and personal data are left out." action={<a href="/api/regulator/export?kind=events" className={`${textLink} text-sm`}>Events CSV</a>}>
        <EventsTable rows={events.slice(0, 300)} />
      </Section>
    </CabinetShell>
  );
}
