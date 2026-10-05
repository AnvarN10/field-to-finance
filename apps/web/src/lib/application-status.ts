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
