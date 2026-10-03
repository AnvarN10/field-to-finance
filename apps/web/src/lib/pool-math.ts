import type { PoolStatusName } from "./chain/enums";
import type { PoolView } from "./chain/views";
import { withYield } from "./format";

export const remaining = (p: PoolView) => {
  const r = BigInt(p.targetAmount) - BigInt(p.raisedAmount);
  return r > 0n ? r : 0n;
};

export function fundedPercent(p: PoolView): string {
  const target = BigInt(p.targetAmount);
  if (target === 0n) return "0.0";
  const tenths = (BigInt(p.raisedAmount) * 1000n) / target;
  return `${tenths / 10n}.${tenths % 10n}`;
}

export const payoutPer = (p: PoolView, principal: bigint) => withYield(principal, p.yieldBps);

export const termDays = (p: PoolView) => Math.floor((p.maturityTs - p.subscriptionCloseTs) / 86_400);

/**
 * Admin console rule: season attestations (Sowing, Vegetation, Harvest) follow disbursement, so they open
 * only once the pool is Funded (or later, Redeeming). Returns the reason the buttons are disabled.
 */
export function seasonAttestationBlocker(status: PoolStatusName, projectCount: number): string | undefined {
  if (status === "Draft" || status === "Open") return "Season attestations follow funding: available once the pool is Funded";
  if (status === "Refunding") return "The pool did not fund; no season to attest";
  if (projectCount === 0) return "No projects in this pool";
  return undefined;
}
