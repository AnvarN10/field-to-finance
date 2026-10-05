import { CircleCheck, CircleDashed, CircleDot, CircleX, Clock, type LucideIcon } from "lucide-react";
import { STATUS_INFO, type ApplicationStatus } from "../../lib/application-status";
import type { DocumentStatus, KycStatus } from "../../lib/db/schema";

const pill = "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

/** Application status pill: green only for live money states, muted for stopped ones, neutral otherwise. */
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const live = status === "open" || status === "funded" || status === "disbursed" || status === "in_season" || status === "harvest";
  const stopped = status === "rejected" || status === "withdrawn" || status === "closed";
  const cls = live ? "border-success/40 bg-success/12 text-success" : stopped ? "border-border text-muted-foreground" : "border-input text-foreground";
  const Icon = stopped ? CircleDashed : live ? CircleDot : Clock;
  return (
    <span className={`${pill} ${cls}`}>
      <Icon aria-hidden strokeWidth={1.5} className="size-3.5" />
      {STATUS_INFO[status].label}
    </span>
  );
}

const DOC: Record<DocumentStatus | "missing", { label: string; cls: string; Icon: LucideIcon }> = {
  missing: { label: "Missing", cls: "border-border text-muted-foreground", Icon: CircleDashed },
  pending: { label: "In review", cls: "border-input text-foreground", Icon: Clock },
  accepted: { label: "Accepted", cls: "border-success/40 text-success", Icon: CircleCheck },
  rejected: { label: "Rejected", cls: "border-destructive/50 text-destructive", Icon: CircleX },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus | "missing" }) {
  const d = DOC[status];
  return (
    <span className={`${pill} ${d.cls}`}>
      <d.Icon aria-hidden strokeWidth={1.5} className="size-3.5" />
      {d.label}
    </span>
  );
}

const KYC: Record<KycStatus, { label: string; cls: string; Icon: LucideIcon }> = {
  not_started: { label: "Not started", cls: "border-border text-muted-foreground", Icon: CircleDashed },
  pending: { label: "Waiting for review", cls: "border-input text-foreground", Icon: Clock },
  approved: { label: "Approved", cls: "border-success/40 text-success", Icon: CircleCheck },
  rejected: { label: "Rejected", cls: "border-destructive/50 text-destructive", Icon: CircleX },
};

export function KycStatusBadge({ status }: { status: KycStatus }) {
  const k = KYC[status];
  return (
    <span className={`${pill} ${k.cls}`}>
      <k.Icon aria-hidden strokeWidth={1.5} className="size-3.5" />
      {k.label}
    </span>
  );
}
