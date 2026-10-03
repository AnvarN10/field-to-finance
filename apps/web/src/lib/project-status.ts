import { SETTLEMENT_LABELS } from "./chain/enums";
import type { ProducerProject } from "./chain/views";
import { formatUsd } from "./format";

export interface ProjectStatus {
  label: string;
  tone: "pending" | "progress" | "success" | "warning";
}

export function projectStatus(p: ProducerProject): ProjectStatus {
  const symbol = p.symbol ?? "the pool";
  if (!p.pool) {
    return p.verifiedFieldCount < p.fieldCount
      ? { label: `Waiting for field checks (${p.verifiedFieldCount} of ${p.fieldCount} verified)`, tone: "pending" }
      : { label: "Verified. Waiting to join a pool", tone: "progress" };
  }
  if (p.settlement) return { label: `Settled: ${SETTLEMENT_LABELS[p.settlement]}`, tone: "success" };
  switch (p.poolStatus) {
    case "Draft":
      return { label: `In ${symbol}, opening soon`, tone: "progress" };
    case "Open":
      return { label: `In ${symbol}, raising from investors`, tone: "progress" };
    case "Refunding":
      return { label: `${symbol} did not reach its target; investors are refunded`, tone: "warning" };
    case "Funded":
    case "Redeeming":
      return p.disbursed
        ? { label: `Funded. ${formatUsd(p.requestedAmount)} paid to you`, tone: "success" }
        : { label: `Funded. Payout of ${formatUsd(p.requestedAmount)} is on its way`, tone: "progress" };
    default:
      return { label: "Status unavailable", tone: "pending" };
  }
}
