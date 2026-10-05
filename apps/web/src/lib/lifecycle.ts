import { effectiveElection, redemptionDue } from "@f2f/sdk";
import type { PoolDetail, PoolView, ProjectView } from "./chain/views";
import { formatDateUtc } from "./format";

export const PHASES = [
  { key: "subscription", label: "Subscription" },
  { key: "funding", label: "Funding" },
  { key: "season", label: "Season" },
  { key: "harvest", label: "Harvest and delivery" },
  { key: "settlement", label: "Settlement" },
  { key: "closing", label: "Closing" },
] as const;
export type PhaseKey = (typeof PHASES)[number]["key"];
export type PhaseOwner = "investors" | "arranger" | "scas" | "elevator" | "lab" | "farmer" | "chain" | null;
export type ArrangerStep = "open_pool" | "close_subscription" | "disburse" | "record_settlement" | "open_redemption" | "sweep";

export interface Phase {
  key: PhaseKey;
  label: string;
  state: "done" | "current" | "todo";
  owner: PhaseOwner;
  next: string;
  /** The button the arranger gets when the current step is theirs. */
  action?: ArrangerStep;
}

type Now = { key: PhaseKey; owner: PhaseOwner; next: string; action?: ArrangerStep } | null;

/**
 * Where a pool stands in its life and who acts next, from chain state alone (plus the vault balance when known).
 * `null` from the rules means every phase is done.
 */
export function lifecycle(d: PoolDetail, nowSec: number, vaultBalance?: bigint): Phase[] {
  const step = currentStep(d, nowSec, vaultBalance);
  const at = step ? PHASES.findIndex((p) => p.key === step.key) : PHASES.length;
  return PHASES.map((p, i) => ({
    key: p.key,
    label: p.label,
    state: i < at ? "done" : i === at ? "current" : "todo",
    owner: i === at && step ? step.owner : null,
    next: i === at && step ? step.next : "",
    ...(i === at && step?.action ? { action: step.action } : {}),
  }));
}

function currentStep(d: PoolDetail, now: number, vault: bigint | undefined): Now {
  const p = d.pool;
  const t = d.terms ?? null;
  const supply = BigInt(p.instrument?.supply ?? "0");
  const matured = now >= p.maturityTs;
  switch (p.status) {
    case "Draft":
      return { key: "subscription", owner: "arranger", next: "Open the pool to investors", action: "open_pool" };
    case "Open": {
      const full = BigInt(p.raisedAmount) >= BigInt(p.targetAmount) && BigInt(p.targetAmount) > 0n;
      if (full || now >= p.subscriptionCloseTs) return { key: "subscription", owner: "arranger", next: full ? "The pool is full: close the subscription" : "The subscription period ended: close it", action: "close_subscription" };
      return { key: "subscription", owner: "investors", next: `Investors subscribe until ${formatDateUtc(p.subscriptionCloseTs)}` };
    }
    case "Refunding":
      return supply === 0n ? null : { key: "closing", owner: "investors", next: "The pool missed its target: holders take refunds" };
    case "Redeeming":
      if (supply > 0n) return { key: "settlement", owner: "investors", next: "Holders redeem their tokens for USDC" };
      return vault === 0n ? null : { key: "closing", owner: "arranger", next: "Every token is redeemed: return the vault remainder and close", action: "sweep" };
    case "Funded":
      break;
  }
  if (p.disbursedCount < p.projectCount) return { key: "funding", owner: "arranger", next: "Disburse the proceeds to the farmer, fees withheld", action: "disburse" };
  const election = t ? effectiveElection(t, now, p.maturityTs) : null;
  const deliveryPossible = Boolean(t && t.settlementMode !== "CashBuyback" && election !== "Buyback");
  const docsMissing = deliveryPossible && (!t?.receiptHash || !t?.labPassed);
  const harvested = d.projects.some((x) => x.harvestAttested);
  if (election === "Delivery" && matured) {
    if (docsMissing) return !t?.receiptHash ? { key: "harvest", owner: "elevator", next: "Record the elevator receipt" } : { key: "harvest", owner: "lab", next: "Record a passing lab protocol" };
    return supply === 0n ? null : { key: "settlement", owner: "investors", next: "Holders claim grain at the elevator" };
  }
  if (!matured) {
    if (!harvested && !(t?.receiptHash || t?.labCertHash)) return { key: "season", owner: "scas", next: "Season attestations: sowing, vegetation, yield estimate" };
    // A failed lab protocol before the election does not block it: the issuer may still choose the buyback.
    const failedLabBeforeElection = election === null && Boolean(t?.receiptHash && t?.labCertHash);
    if (docsMissing && !failedLabBeforeElection) return !t?.receiptHash ? { key: "harvest", owner: "elevator", next: "Record the elevator receipt" } : { key: "harvest", owner: "lab", next: "Record a passing lab protocol" };
    if (t && election === null) return { key: "settlement", owner: "farmer", next: `Elect buyback or delivery before ${formatDateUtc(p.maturityTs)}` };
    if (election === "Delivery") return { key: "settlement", owner: "chain", next: `Holders claim grain after maturity, ${formatDateUtc(p.maturityTs)}` };
  }
  // Buyback path (or a pool without a term sheet).
  const due = redemptionDue(BigInt(p.raisedAmount), { yieldBps: p.yieldBps, maturityTs: p.maturityTs }, t);
  const short = vault !== undefined && vault < due;
  if (!matured) return short ? { key: "settlement", owner: "farmer", next: "Fund the buyback before maturity" } : { key: "settlement", owner: "chain", next: `Redemption opens after maturity, ${formatDateUtc(p.maturityTs)}` };
  if (d.projects.some((x) => x.settlement === null)) return { key: "settlement", owner: "arranger", next: "Record the settlement of each project", action: "record_settlement" };
  if (short && t) return { key: "settlement", owner: "farmer", next: "Fund the buyback: the vault is short" };
  return { key: "settlement", owner: "arranger", next: "Open redemption for holders", action: "open_redemption" };
}

/** Pool details for the board from one pool list and one project scan (no field reads): what `lifecycle` needs. */
export function boardDetails(pools: PoolView[], projects: ProjectView[]): PoolDetail[] {
  return pools.map((pool) => ({ pool, projects: projects.filter((p) => p.pool === pool.address).map((p) => ({ ...p, fields: [] })), arrangementFeeBps: 0, terms: pool.terms ?? null }));
}
