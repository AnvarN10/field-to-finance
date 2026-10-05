/** Application status machine (spec 2026-10-05 section 4). From `open` on, statuses are derived from chain state. */
export const PIPELINE_STATUSES = [
  "draft",
  "submitted",
  "documents_review",
  "kyc",
  "field_verification",
  "structuring",
  "ready",
  "open",
  "funded",
  "disbursed",
  "in_season",
  "harvest",
  "settlement",
  "closed",
] as const;
export const APPLICATION_STATUSES = [...PIPELINE_STATUSES, "rejected", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type StatusOwner = "farmer" | "arranger" | "investors" | "chain" | null;

export const STATUS_INFO: Record<ApplicationStatus, { label: string; owner: StatusOwner; next: string }> = {
  draft: { label: "Draft", owner: "farmer", next: "Complete the application, upload the documents and fields, then submit" },
  submitted: { label: "Submitted", owner: "arranger", next: "Start the document review" },
  documents_review: { label: "Document review", owner: "arranger", next: "Accept or reject each document" },
  kyc: { label: "Issuer KYC", owner: "arranger", next: "Decide the issuer's KYC" },
  field_verification: { label: "Field verification", owner: "arranger", next: "Verify the fields with the SCAS stub" },
  structuring: { label: "Structuring", owner: "arranger", next: "Build the terms and create the pool" },
  ready: { label: "Ready to publish", owner: "arranger", next: "Publish the pool to investors" },
  open: { label: "Open for subscription", owner: "investors", next: "Investors subscribe until the pool closes" },
  funded: { label: "Funded", owner: "arranger", next: "Disburse the proceeds to the farmer" },
  disbursed: { label: "Disbursed", owner: "farmer", next: "Grow the crop; season checks follow" },
  in_season: { label: "In season", owner: "chain", next: "Season attestations continue until harvest" },
  harvest: { label: "Harvest", owner: "arranger", next: "Record settlement for the harvest" },
  settlement: { label: "Settlement", owner: "farmer", next: "Fund the buyback or deliver the grain" },
  closed: { label: "Closed", owner: null, next: "Nothing left to do" },
  rejected: { label: "Rejected", owner: null, next: "The arranger declined this application" },
  withdrawn: { label: "Withdrawn", owner: null, next: "You withdrew this application" },
};

const CHAIN_SET = new Set<ApplicationStatus>(PIPELINE_STATUSES.slice(PIPELINE_STATUSES.indexOf("open")));
export const CHAIN_STATUSES = [...CHAIN_SET];
export const isChainDerived = (s: ApplicationStatus) => CHAIN_SET.has(s);

/** Manual moves only; everything from `open` on comes from chain state via deriveFromChain. */
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (isChainDerived(from) || from === "rejected" || from === "withdrawn") return false;
  if (to === "withdrawn") return true;
  if (to === "rejected") return from !== "draft";
  const i = PIPELINE_STATUSES.indexOf(from);
  return i >= 0 && PIPELINE_STATUSES[i + 1] === to && PIPELINE_STATUSES.indexOf(to) <= PIPELINE_STATUSES.indexOf("open");
}

/** The chain state deriveFromChain reads (a PoolDetail satisfies it). */
export interface ChainStatusInput {
  pool: { status: "Draft" | "Open" | "Funded" | "Refunding" | "Redeeming"; maturityTs: number; projectCount: number; disbursedCount: number; instrument: { supply: string } | null };
  projects: { disbursed: boolean; harvestAttested: boolean; fields: { attestationCount: number }[] }[];
}

/** Status from the on-chain pool; null while the pool is still Draft (the stored `ready` stands). */
export function deriveFromChain(d: ChainStatusInput, nowSec: number): ApplicationStatus | null {
  const p = d.pool;
  switch (p.status) {
    case "Draft":
      return null;
    case "Open":
      return "open";
    case "Refunding":
      return "closed";
    case "Redeeming":
      return BigInt(p.instrument?.supply ?? "1") === 0n ? "closed" : "settlement";
    case "Funded":
      if (nowSec >= p.maturityTs) return "settlement";
      if (p.disbursedCount < p.projectCount) return "funded";
      if (d.projects.some((x) => x.harvestAttested)) return "harvest";
      // Every field carries its FieldVerified attestation; anything beyond it is a season attestation.
      if (d.projects.some((x) => x.fields.some((f) => f.attestationCount > 1))) return "in_season";
      return "disbursed";
  }
}

export type TimelineStep = { status: ApplicationStatus; label: string; state: "done" | "current" | "todo" };

export function timeline(current: ApplicationStatus): TimelineStep[] {
  const at = PIPELINE_STATUSES.indexOf(current as (typeof PIPELINE_STATUSES)[number]);
  return PIPELINE_STATUSES.map((status, i) => ({
    status,
    label: STATUS_INFO[status].label,
    state: at < 0 ? "todo" : i < at ? "done" : i === at ? (current === "closed" ? "done" : "current") : "todo",
  }));
}
