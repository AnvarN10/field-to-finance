import { splitArrangementFee } from "@f2f/sdk";
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

/** Admin "Close subscription": past states say what already happened instead of the Open-pool rule. */
export function closeSubscriptionBlocker(status: PoolStatusName, closeReady: boolean): string | undefined {
  if (status === "Draft") return "Open the pool first";
  if (status !== "Open") return "Subscription already closed";
  return closeReady ? undefined : "Available when the pool is full or after the close time";
}

export function disburseBlocker(status: PoolStatusName, allDisbursed: boolean): string | undefined {
  if (status === "Refunding") return "The pool did not fund; investors refund instead";
  if (allDisbursed && (status === "Funded" || status === "Redeeming")) return "Every project is paid";
  return status === "Funded" ? undefined : "Needs a Funded pool";
}

export function fundRedemptionBlocker(status: PoolStatusName): string | undefined {
  if (status === "Redeeming") return "Redemption already funded";
  return status === "Funded" ? undefined : "Needs a Funded pool";
}

/** Arrangement fee over a pool's projects, floored per project exactly as `disburse` does (ADR 0013). */
export function arrangementSplit(projects: { requestedAmount: string }[], bps: number): { requested: bigint; fee: bigint; net: bigint } {
  return projects.reduce(
    (acc, p) => {
      const r = BigInt(p.requestedAmount);
      const { fee, net } = splitArrangementFee(r, bps);
      return { requested: acc.requested + r, fee: acc.fee + fee, net: acc.net + net };
    },
    { requested: 0n, fee: 0n, net: 0n },
  );
}
