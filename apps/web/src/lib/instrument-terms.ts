import { actualDays, effectiveElection, grainClaimKg, redemptionDue, tokenizedKg, type SettlementElectionName, type SettlementModeName } from "@f2f/sdk";
import type { InstrumentTermsView, PoolView } from "./chain/views";
import { formatUsd, formatYield } from "./format";
import type { SubscriptionCheck } from "./invest";

/** Term-sheet presentation helpers (ADR 0014). Amounts are USDC base units, 1 token = `unitNominal`. */

export const tokenCount = (amount: string | bigint, t: InstrumentTermsView) => BigInt(amount) / BigInt(t.unitNominal);

export const interestDays = (p: Pick<PoolView, "maturityTs">, t: InstrumentTermsView) =>
  t.startTs <= p.maturityTs ? actualDays(t.startTs, p.maturityTs) : 0;

const dueArgs = (p: Pick<PoolView, "yieldBps" | "maturityTs">, t: InstrumentTermsView) =>
  [{ yieldBps: p.yieldBps, maturityTs: p.maturityTs }, { couponBpsAnnual: t.couponBpsAnnual, startTs: t.startTs }] as const;

/** Cash at maturity for `amount` base units, exactly as the program computes it. */
export const payoutForAmount = (p: Pick<PoolView, "yieldBps" | "maturityTs">, t: InstrumentTermsView, amount: bigint) =>
  redemptionDue(amount, ...dueArgs(p, t));

export const payoutForTokens = (p: Pick<PoolView, "yieldBps" | "maturityTs">, t: InstrumentTermsView, tokens: bigint) =>
  payoutForAmount(p, t, tokens * BigInt(t.unitNominal));

export const couponLabel = (t: InstrumentTermsView) => `${formatYield(t.couponBpsAnnual)} a year, ${t.dayCount === "Act360" ? "Act/360" : "Act/365"}`;

export function instrumentTypeLabel(mode: SettlementModeName): string {
  switch (mode) {
    case "Hybrid":
      return "Hybrid: grain delivery with the issuer's right to buy the token back";
    case "GrainDelivery":
      return "Grain delivery at the elevator";
    case "CashBuyback":
      return "Cash buyback of principal plus coupon";
  }
}

export function validateTokenSubscription(
  input: string,
  unitNominal: bigint,
  remaining: bigint,
  w: { networkFee: bigint; usdcBalance: bigint | null },
): SubscriptionCheck {
  const s = input.trim();
  if (!/^\d{1,6}$/.test(s)) return { ok: false, reason: "amount", message: "Enter a whole number of tokens" };
  const tokens = BigInt(s);
  if (tokens === 0n) return { ok: false, reason: "amount", message: "Buy at least 1 token" };
  const left = remaining / unitNominal;
  if (tokens > left) return { ok: false, reason: "amount", message: `The pool has ${left} token${left === 1n ? "" : "s"} left` };
  const amount = tokens * unitNominal;
  const total = amount + w.networkFee;
  if (w.usdcBalance !== null && w.usdcBalance < total) {
    return { ok: false, reason: "balance", message: `You need ${formatUsd(total)} in test USDC (tokens plus ${formatUsd(w.networkFee)} network fee); this wallet has ${formatUsd(w.usdcBalance)}` };
  }
  return { ok: true, amount, total };
}

export interface SettlementStatus {
  election: SettlementElectionName | null;
  label: string;
}

export function settlementStatus(p: Pick<PoolView, "maturityTs">, t: InstrumentTermsView, nowSec: number): SettlementStatus {
  const election = effectiveElection(t, nowSec, p.maturityTs);
  if (t.settlementMode === "CashBuyback") return { election, label: "Cash buyback at maturity" };
  if (t.settlementMode === "GrainDelivery") return { election, label: "Grain delivery at maturity" };
  if (t.election === "Buyback") return { election, label: "The issuer elected buyback: holders are paid in cash" };
  if (t.election === "Delivery") return { election, label: "The issuer elected grain delivery" };
  if (election === "Delivery") return { election, label: "No buyback was elected by maturity: grain delivery applies" };
  return { election, label: "The issuer has not elected yet. Without a buyback election by maturity, grain delivery applies." };
}

/** Grain claims are open: delivery applies, maturity passed, receipt and passing lab certificate recorded. */
export function deliveryOpen(p: Pick<PoolView, "maturityTs" | "status">, t: InstrumentTermsView, nowSec: number): boolean {
  return p.status === "Funded" && nowSec >= p.maturityTs && effectiveElection(t, nowSec, p.maturityTs) === "Delivery" && t.receiptHash !== null && t.labPassed;
}

export const tokenizedKgOf = (t: InstrumentTermsView) => tokenizedKg(BigInt(t.volumeKg), t.tokenizedShareBps);

/** Kilograms `amount` base units claim, like `redeem_delivery`. */
export const claimableKg = (p: Pick<PoolView, "raisedAmount">, t: InstrumentTermsView, amount: bigint) =>
  grainClaimKg(amount, tokenizedKgOf(t), BigInt(p.raisedAmount));
