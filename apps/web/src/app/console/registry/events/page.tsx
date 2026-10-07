import type { Metadata } from "next";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { REGISTRY_TABS } from "@/components/console/sub-tabs";
import { Section, textLink } from "@/components/cabinet/section";
import { EventsTable } from "@/components/regulator/tables";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { regulatorEvents } from "@/lib/server/regulator-data";

export const metadata: Metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function RegulatorEvents() {
  const g = await guardConsole("registry.view", "/console/registry/events");
  if ("element" in g) return g.element;
  let events;
  try {
    events = await regulatorEvents(await getDb());
  } catch {
    return <ErrorState level={1} title="Events are unavailable" body="Accounts did not answer. Try again in a minute." retryHref="/console/registry/events" />;
  }
  return (
    <ConsolePage title="Events" tabs={REGISTRY_TABS}>
      <Section title="Platform events" description="The latest 1,000 decisions and on-chain actions, newest first, with the role that acted; a pool's page shows its whole history. Review notes and personal data are left out." action={<a href="/api/regulator/export?kind=events" className={`${textLink} text-sm`}>Events CSV</a>}>
        <EventsTable rows={events.slice(0, 300)} />
      </Section>
    </ConsolePage>
  );
}
