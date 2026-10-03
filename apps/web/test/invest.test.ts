import { describe, expect, it } from "vitest";
import type { InvestorState, PoolView } from "../src/lib/chain/views";
import { panelMode, positionFor, validateAmount } from "../src/lib/invest";

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
