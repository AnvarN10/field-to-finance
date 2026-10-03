import { describe, expect, it } from "vitest";
import type { InvestorState, PoolView } from "../src/lib/chain/views";
import { disconnectedCopy, panelMode, positionFor, validateAmount, subscriptionTotal, validateSubscription } from "../src/lib/invest";

const pool = (o: Partial<PoolView>) => ({ status: "Open", subscriptionCloseTs: 1000, targetAmount: "10", raisedAmount: "0", ...o }) as PoolView;

describe("panelMode", () => {
  it("follows the pool status and the close time", () => {
    expect(panelMode(pool({ status: "Draft" }), 0)).toBe("draft");
    expect(panelMode(pool({}), 999)).toBe("subscribe");
    expect(panelMode(pool({}), 1000)).toBe("closed");
    expect(panelMode(pool({ raisedAmount: "10" }), 10)).toBe("closed");
    expect(panelMode(pool({ status: "Funded" }), 0)).toBe("closed-funded");
    expect(panelMode(pool({ status: "Refunding" }), 0)).toBe("refund");
    expect(panelMode(pool({ status: "Redeeming" }), 0)).toBe("redeem");
  });
});

describe("validateAmount", () => {
  it("accepts dollars up to the remaining capacity", () => {
    expect(validateAmount("250.5", 1_000_000_000n)).toEqual({ ok: true, amount: 250_500_000n });
  });
  it("explains what is wrong", () => {
    expect(validateAmount("", 1n)).toEqual({ ok: false, message: "Enter an amount in dollars, for example 250 or 250.50" });
    expect(validateAmount("0", 1n)).toEqual({ ok: false, message: "Enter an amount above $0.00" });
    expect(validateAmount("2", 1_000_000n)).toEqual({ ok: false, message: "The pool needs at most $1.00 more" });
  });
});

describe("positionFor", () => {
  it("finds the position for a pool", () => {
    const state = { positions: [{ poolId: "7", balance: "5" }] } as unknown as InvestorState;
    expect(positionFor(state, "7")?.balance).toBe("5");
    expect(positionFor(state, "8")).toBeNull();
    expect(positionFor(null, "7")).toBeNull();
  });
});

describe("disconnectedCopy", () => {
  it("matches what the pool allows instead of always inviting a subscription", () => {
    expect(disconnectedCopy("subscribe", 800)).toBe("Connect a Solana wallet on devnet to subscribe. Fixed yield 8.0%, paid at maturity.");
    expect(disconnectedCopy("redeem", 800)).toBe("This pool is paying out. Connect the wallet that holds its Instrument to redeem principal plus 8.0%.");
    expect(disconnectedCopy("refund", 800)).toBe("This pool did not reach its target. Connect the wallet you subscribed with to get your USDC back.");
    expect(disconnectedCopy("closed-funded", 800)).toBe("Subscription is closed. Connect a wallet to see your position.");
    expect(disconnectedCopy("draft", 800)).toBe("This pool is not open yet. Connect a wallet to be ready when it opens.");
  });
});

describe("subscription checkout (ADR 0013 network fee)", () => {
  it("adds the network fee on top of the amount", () => {
    expect(subscriptionTotal(250_000_000n, 500_000n)).toBe(250_500_000n);
    expect(subscriptionTotal(250_000_000n, 0n)).toBe(250_000_000n);
  });

  it("checks the wallet can pay amount plus fee", () => {
    expect(validateSubscription("250", 1_000_000_000n, { networkFee: 500_000n, usdcBalance: 250_500_000n })).toEqual({ ok: true, amount: 250_000_000n, total: 250_500_000n });
    expect(validateSubscription("250", 1_000_000_000n, { networkFee: 500_000n, usdcBalance: 250_000_000n })).toEqual({
      ok: false,
      message: "You need $250.50 in test USDC (amount plus $0.50 network fee); this wallet has $250.00",
      reason: "balance",
    });
  });

  it("keeps the capacity check first", () => {
    expect(validateSubscription("5", 1_000_000n, { networkFee: 500_000n, usdcBalance: 10_000_000n })).toMatchObject({ ok: false, message: "The pool needs at most $1.00 more" });
  });
});
