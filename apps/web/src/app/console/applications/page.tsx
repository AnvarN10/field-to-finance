import type { Metadata } from "next";
import Link from "next/link";
import { PipelineBoard } from "@/components/arranger/pipeline-board";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { ErrorState } from "@/components/state";
import { APPLICATION_STATUSES, STATUS_INFO, type ApplicationStatus } from "@/lib/application-status";
import { getDb } from "@/lib/server/db";
import { refreshStatuses } from "@/lib/server/status-refresh";
import { farmerKycQueue, investorQueue, pipeline } from "@/lib/workflow/arranger";

export const metadata: Metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

const chip = "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors duration-150";

export default async function ArrangerHome({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const g = await guardConsole("applications.view", "/console/applications");
  if ("element" in g) return g.element;
  const raw = (await searchParams).status;
  const filter = (APPLICATION_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as ApplicationStatus) : null;
  let rows, farmerKyc, investorKyc;
  try {
    const db = await getDb();
    await refreshStatuses(db);
    [rows, farmerKyc, investorKyc] = await Promise.all([pipeline(db), farmerKycQueue(db), investorQueue(db)]);
  } catch {
    return <ErrorState level={1} title="This section is unavailable" body="The pipeline could not be loaded. Try again in a minute." retryHref="/console/applications" />;
  }
  const counts = new Map<ApplicationStatus, number>();
  for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const present = APPLICATION_STATUSES.filter((s) => counts.get(s));

  return (
    <ConsolePage title="Issuance pipeline">
      {farmerKyc.length || investorKyc.length ? (
        <p className="text-sm">
          {farmerKyc.length ? `${farmerKyc.length} issuer KYC waiting in applications. ` : ""}
          {investorKyc.length ? (
            <Link href="/console/investors" className="font-medium text-foreground underline decoration-muted-foreground underline-offset-4">
              {`${investorKyc.length} investor KYC waiting`}
            </Link>
          ) : null}
        </p>
      ) : null}
      {present.length ? (
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          <Link href="/console/applications" aria-current={!filter ? "page" : undefined} className={`${chip} ${!filter ? "border-primary text-foreground" : "border-input text-muted-foreground"}`}>
            {`All ${rows.length}`}
          </Link>
          {present.map((s) => (
            <Link key={s} href={`/console/applications?status=${s}`} aria-current={filter === s ? "page" : undefined} className={`${chip} ${filter === s ? "border-primary text-foreground" : "border-input text-muted-foreground"}`}>
              {`${STATUS_INFO[s].label} ${counts.get(s)}`}
            </Link>
          ))}
        </nav>
      ) : null}
      {rows.length ? (
        <PipelineBoard rows={rows} filter={filter} />
      ) : (
        <p className="text-sm text-muted-foreground">No applications yet. Farmers apply through Get financing (/apply); a submitted application appears here.</p>
      )}
    </ConsolePage>
  );
}
