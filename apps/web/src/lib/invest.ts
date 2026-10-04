import type { InvestorState, PoolView, PositionView } from "./chain/views";
import { formatUsd, formatYield, parseUsd } from "./format";
import type { InstrumentTermsView } from "./chain/views";
import { couponLabel, deliveryOpen } from "./instrument-terms";

export type PanelMode = "draft" | "subscribe" | "closed-funded" | "deliver" | "refund" | "redeem" | "closed";

export function panelMode(pool: PoolView, nowSec: number): PanelMode {
  switch (pool.status) {
    case "Draft":
      return "draft";
    case "Open":
      return nowSec < pool.subscriptionCloseTs && BigInt(pool.raisedAmount) < BigInt(pool.targetAmount) ? "subscribe" : "closed";
    case "Funded":
      return pool.terms && deliveryOpen(pool, pool.terms, nowSec) ? "deliver" : "closed-funded";
    case "Refunding":
      return "refund";
    case "Redeeming":
      return "redeem";
  }
}

export function validateAmount(input: string, max: bigint): { ok: true; amount: bigint } | { ok: false; message: string } {
  let amount: bigint;
  try {
    amount = parseUsd(input);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (amount <= 0n) return { ok: false, message: "Enter an amount above $0.00" };
  if (amount > max) return { ok: false, message: `The pool needs at most ${formatUsd(max)} more` };
  return { ok: true, amount };
}

export const positionFor = (state: InvestorState | null, poolId: string): PositionView | null =>
  state?.positions.find((p) => p.poolId === poolId) ?? null;

/** Invest panel text before a wallet is connected, matched to what the pool allows right now. */
export function disconnectedCopy(mode: PanelMode, yieldBps: number, terms: InstrumentTermsView | null = null): string {
  const y = terms ? `the coupon (${couponLabel(terms)})` : formatYield(yieldBps);
  switch (mode) {
    case "subscribe":
      return terms
        ? `Connect a Solana wallet on devnet to buy whole tokens of ${formatUsd(terms.unitNominal)}. Coupon ${couponLabel(terms)}, paid at maturity.`
        : `Connect a Solana wallet on devnet to subscribe. Fixed yield ${y}, paid at maturity.`;
    case "deliver":
      return "Grain delivery applies. Connect the wallet that holds the tokens to claim your share of the grain.";
    case "redeem":
      return `This pool is paying out. Connect the wallet that holds its Instrument to redeem principal plus ${y}.`;
    case "refund":
      return "This pool did not reach its target. Connect the wallet you subscribed with to get your USDC back.";
    case "draft":
      return "This pool is not open yet. Connect a wallet to be ready when it opens.";
    default:
      return "Subscription is closed. Connect a wallet to see your position.";
  }
}

/** ADR 0013: the investor pays a fixed USDC network fee on top of each subscription. */
export const subscriptionTotal = (amount: bigint, networkFee: bigint) => amount + networkFee;

export type SubscriptionCheck = { ok: true; amount: bigint; total: bigint } | { ok: false; message: string; reason: "amount" | "balance" };

/** Capacity first, then whether the wallet can pay amount plus the network fee. */
/** `usdcBalance` null (still loading or failed to load): the balance check is skipped; the program checks it anyway. */
export function validateSubscription(input: string, max: bigint, w: { networkFee: bigint; usdcBalance: bigint | null }): SubscriptionCheck {
  const v = validateAmount(input, max);
  if (!v.ok) return { ...v, reason: "amount" };
  const total = subscriptionTotal(v.amount, w.networkFee);
  if (w.usdcBalance !== null && w.usdcBalance < total) {
    const fee = w.networkFee > 0n ? ` (amount plus ${formatUsd(w.networkFee)} network fee)` : "";
    return { ok: false, reason: "balance", message: `You need ${formatUsd(total)} in test USDC${fee}; this wallet has ${formatUsd(w.usdcBalance)}` };
  }
  return { ok: true, amount: v.amount, total };
}
