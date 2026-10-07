import Link from "next/link";
import { STATUS_INFO, type ApplicationStatus } from "../../lib/application-status";
import { farmerStatusLine } from "../../lib/issuer-next-action";
import { formatUsd } from "../../lib/format";
import { ApplicationStatusBadge } from "../cabinet/badges";
import { EmptyState } from "../state";

export type ApplicationSummary = { id: string; crop: string; season: number; requestedUsd: number; status: ApplicationStatus; statusNote: string | null };

const link = "rounded-sm font-medium text-foreground underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current";

const usd = (whole: number) => formatUsd(BigInt(whole) * 1_000_000n);

export function ApplicationList({ applications, canCreate }: { applications: ApplicationSummary[]; canCreate: boolean }) {
  if (!applications.length) {
    return (
      <EmptyState
        title="No applications yet"
        body={canCreate ? "An application describes the harvest you finance: crop, volume, amount, elevator and laboratory." : "Complete your company profile first, then start an application."}
        action={
          <Link href={canCreate ? "/issuer/applications/new" : "/issuer/company"} className={link}>
            {canCreate ? "Start your first application" : "Complete your profile"}
          </Link>
        }
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
      {applications.map((a) => {
        const info = STATUS_INFO[a.status];
        return (
          <li key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium capitalize">{`${a.crop} ${a.season}`}</span>
                <span className="tabular text-sm text-muted-foreground">{usd(a.requestedUsd)}</span>
                <ApplicationStatusBadge status={a.status} />
              </div>
              <p className="text-sm text-muted-foreground">{`${a.statusNote ?? farmerStatusLine(a.status)}${info.owner === "farmer" ? " · Your step" : ""}`}</p>
            </div>
            <Link href={`/issuer/applications/${a.id}`} className={link} aria-label={`Open ${a.crop} ${a.season}`}>
              Open
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
