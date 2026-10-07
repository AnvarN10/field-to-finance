import Link from "next/link";
import { STATUS_INFO, type ApplicationStatus } from "../../lib/application-status";
import { formatUsd } from "../../lib/format";
import { ApplicationStatusBadge } from "../cabinet/badges";

export type PipelineCard = { id: string; crop: string; season: number; requestedUsd: number; status: ApplicationStatus; farmerEmail: string; legalName: string | null; updatedAt: Date };

/** Stages of the issuance pipeline, each a column of statuses. Drafts stay with the farmer and are only counted. */
export const STAGES: { key: string; label: string; statuses: ApplicationStatus[] }[] = [
  { key: "intake", label: "Intake", statuses: ["submitted", "documents_review"] },
  { key: "diligence", label: "Diligence", statuses: ["kyc", "field_verification"] },
  { key: "structuring", label: "Structuring", statuses: ["structuring", "ready"] },
  { key: "live", label: "Live", statuses: ["open", "funded", "disbursed", "in_season", "harvest", "settlement"] },
  { key: "done", label: "Closed", statuses: ["closed", "rejected", "withdrawn"] },
];

export function PipelineBoard({ rows, filter }: { rows: PipelineCard[]; filter: ApplicationStatus | null }) {
  const visible = filter ? rows.filter((r) => r.status === filter) : rows;
  const drafts = rows.filter((r) => r.status === "draft").length;
  return (
    <div className="flex flex-col gap-4">
      {drafts && !filter ? <p className="text-sm text-muted-foreground">{`${drafts} draft${drafts === 1 ? " is" : "s are"} still with farmers.`}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {STAGES.map((stage) => {
          const cards = visible.filter((r) => stage.statuses.includes(r.status));
          return (
            <section key={stage.key} aria-label={`${stage.label}, ${cards.length}`} className="flex min-w-0 flex-col gap-3">
              <h2 className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm font-semibold">
                {stage.label}
                <span className="tabular rounded-full bg-raised px-2 py-0.5 text-xs font-medium text-foreground">{cards.length}</span>
              </h2>
              {cards.length === 0 ? <p className="text-xs text-muted-foreground">Nothing here</p> : null}
              {cards.map((c) => (
                <Link
                  key={c.id}
                  href={`/console/applications/${c.id}`}
                  className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 transition-colors duration-150 [@media(hover:hover)]:hover:border-input"
                >
                  <span className="line-clamp-2 text-sm font-medium break-words">{`${c.legalName ?? c.farmerEmail} · ${c.crop} ${c.season}`}</span>
                  <span className="tabular text-xs text-muted-foreground">{formatUsd(BigInt(c.requestedUsd) * 1_000_000n)}</span>
                  <ApplicationStatusBadge status={c.status} />
                  <span className="text-xs text-muted-foreground">{STATUS_INFO[c.status].next}</span>
                </Link>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
