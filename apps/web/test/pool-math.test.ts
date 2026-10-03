import { describe, expect, it } from "vitest";
import { fundedPercent, payoutPer, remaining, termDays } from "../src/lib/pool-math";
import type { PoolView } from "../src/lib/chain/views";

const p = (o: Partial<PoolView> = {}) =>
  ({ targetAmount: "2000000000", raisedAmount: "500000000", yieldBps: 800, subscriptionCloseTs: 0, maturityTs: 86_400 * 30, ...o }) as PoolView;

describe("pool math", () => {
  it("computes remaining capacity and funded percent", () => {
    expect(remaining(p())).toBe(1_500_000_000n);
    expect(fundedPercent(p())).toBe("25.0");
    expect(fundedPercent(p({ targetAmount: "0", raisedAmount: "0" }))).toBe("0.0");
    expect(fundedPercent(p({ raisedAmount: "2000000000" }))).toBe("100.0");
  });

  it("computes the payout for a principal like the program", () => {
    expect(payoutPer(p(), 1_000_000_000n)).toBe(1_080_000_000n);
  });

  it("computes the term from subscription close to maturity in days", () => {
    expect(termDays(p())).toBe(30);
    expect(termDays(p({ maturityTs: 600 }))).toBe(0);
  });
});
