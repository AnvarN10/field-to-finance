"use client";

import { CircleCheck, CircleDashed, CircleDot, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ProducerProject } from "../../lib/chain/views";
import { formatHa, formatTonnes, formatUsd } from "../../lib/format";
import { projectStatus, type ProjectStatus } from "../../lib/project-status";
import { EmptyState, ErrorState } from "../state";
import { useJson } from "../use-json";

const TONE: Record<ProjectStatus["tone"], { className: string; Icon: LucideIcon }> = {
  pending: { className: "text-muted-foreground", Icon: CircleDashed },
  progress: { className: "text-info", Icon: CircleDot },
  success: { className: "text-success", Icon: CircleCheck },
  warning: { className: "text-warning", Icon: TriangleAlert },
};

export function ProjectList({ wallet, refreshKey }: { wallet: string; refreshKey: number }) {
  const { data, error, loading, reload } = useJson<{ projects: ProducerProject[] }>(`/api/producer/${wallet}?k=${refreshKey}`);
  if (error) return <ErrorState title="Could not load your projects" body={error} onRetry={reload} />;
  if (loading && !data) return <div className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" role="status" aria-label="Loading projects" />;
  if (!data?.projects.length) return <EmptyState title="No projects yet" body="Register your fields below to request financing for next season." />;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
      {data.projects.map((p) => {
        const s = projectStatus(p);
        const tone = TONE[s.tone];
        return (
          <li key={p.address} className="flex flex-col gap-2 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                <span className="capitalize">{p.crop}</span> {p.season}
              </span>
              <span className={`inline-flex items-center gap-1.5 font-medium ${tone.className}`}>
                <tone.Icon aria-hidden strokeWidth={1.5} className="size-4" />
                {s.label}
              </span>
            </div>
            <p className="tabular text-muted-foreground">
              {`Expected ${formatTonnes(p.expectedKg)}, 30% tokenized (${formatTonnes(p.tokenizedKg)}). Requested ${formatUsd(p.requestedAmount)}.`}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {p.fields.map((f) => (
                <li key={f.address}>
                  <Link
                    href={`/fields/${f.address}`}
                    className="rounded-sm underline decoration-border underline-offset-4 [@media(hover:hover)]:hover:decoration-foreground"
                  >
                    {`Field ${f.index + 1}, ${formatHa(f.areaHaX100)}${f.verified ? ", verified" : ""}`}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
