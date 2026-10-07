import type { Metadata } from "next";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { Inbox } from "@/components/console/inbox";
import { navFor } from "@/components/console/nav-items";
import { ErrorState } from "@/components/state";
import { boardDetails } from "@/lib/lifecycle";
import { getReader } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import { refreshStatuses } from "@/lib/server/status-refresh";
import { inboxQueues, type InboxChain } from "@/lib/workflow/inbox";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

async function chainFor(needsPools: boolean, needsDetails: boolean): Promise<InboxChain> {
  if (!needsPools) return { pools: [], details: [] };
  try {
    const reader = getReader();
    const pools = await reader.listPools();
    return { pools, details: needsDetails ? boardDetails(pools, await reader.allProjects()) : [] };
  } catch {
    return null;
  }
}

export default async function ConsoleInbox() {
  const g = await guardConsole(null, "/console");
  if ("element" in g) return g.element;
  const p = g.permissions;
  let queues;
  try {
    const db = await getDb();
    await refreshStatuses(db);
    const chain = await chainFor(p.has("pools.operate") || p.has("delivery.receipt") || p.has("delivery.lab"), p.has("pools.operate"));
    queues = await inboxQueues(db, p, chain, Math.floor(Date.now() / 1000));
  } catch {
    return <ErrorState level={1} title="The inbox is unavailable" body="Work queues could not be loaded. Try again in a minute." retryHref="/console" />;
  }
  return (
    <ConsolePage title="Inbox" description="What waits for you, by the sections your roles open.">
      <Inbox queues={queues} sections={navFor(p).filter((s) => s.href !== "/console")} />
    </ConsolePage>
  );
}
