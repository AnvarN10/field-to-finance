import type { InvestorState, PoolView, PositionView } from "./chain/views";
import { formatUsd, parseUsd } from "./format";

export type PanelMode = "draft" | "subscribe" | "closed-funded" | "refund" | "redeem" | "closed";

export function panelMode(pool: PoolView, nowSec: number): PanelMode {
  switch (pool.status) {
    case "Draft":
      return "draft";
    case "Open":
      return nowSec < pool.subscriptionCloseTs && BigInt(pool.raisedAmount) < BigInt(pool.targetAmount) ? "subscribe" : "closed";
    case "Funded":
      return "closed-funded";
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
