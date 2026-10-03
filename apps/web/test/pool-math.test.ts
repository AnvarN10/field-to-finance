import { describe, expect, it } from "vitest";
import { closeSubscriptionBlocker, disburseBlocker, fundRedemptionBlocker, fundedPercent, payoutPer, remaining, seasonAttestationBlocker, termDays, arrangementSplit } from "../src/lib/pool-math";
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

describe("seasonAttestationBlocker", () => {
  it("blocks season attestations until the pool is funded and disbursement can follow", () => {
    expect(seasonAttestationBlocker("Draft", 1)).toBe("Season attestations follow funding: available once the pool is Funded");
    expect(seasonAttestationBlocker("Open", 1)).toBe("Season attestations follow funding: available once the pool is Funded");
    expect(seasonAttestationBlocker("Refunding", 1)).toBe("The pool did not fund; no season to attest");
  });

  it("allows them for Funded and Redeeming pools with projects", () => {
    expect(seasonAttestationBlocker("Funded", 1)).toBeUndefined();
    expect(seasonAttestationBlocker("Redeeming", 2)).toBeUndefined();
    expect(seasonAttestationBlocker("Funded", 0)).toBe("No projects in this pool");
  });
});

describe("admin lifecycle reasons name what already happened", () => {
  it("close subscription", () => {
    expect(closeSubscriptionBlocker("Draft", false)).toBe("Open the pool first");
    expect(closeSubscriptionBlocker("Open", false)).toBe("Available when the pool is full or after the close time");
    expect(closeSubscriptionBlocker("Open", true)).toBeUndefined();
    expect(closeSubscriptionBlocker("Redeeming", false)).toBe("Subscription already closed");
    expect(closeSubscriptionBlocker("Funded", false)).toBe("Subscription already closed");
  });

  it("disburse", () => {
    expect(disburseBlocker("Open", false)).toBe("Needs a Funded pool");
    expect(disburseBlocker("Funded", false)).toBeUndefined();
    expect(disburseBlocker("Funded", true)).toBe("Every project is paid");
    expect(disburseBlocker("Redeeming", true)).toBe("Every project is paid");
    expect(disburseBlocker("Refunding", false)).toBe("The pool did not fund; investors refund instead");
  });

  it("fund redemption", () => {
    expect(fundRedemptionBlocker("Open")).toBe("Needs a Funded pool");
    expect(fundRedemptionBlocker("Funded")).toBeUndefined();
    expect(fundRedemptionBlocker("Redeeming")).toBe("Redemption already funded");
  });
});

describe("arrangementSplit", () => {
  it("floors per project like disburse, then sums", () => {
    // 1% of 150 floors to 1 per project (2 in total); flooring the pool total would say 3.
    expect(arrangementSplit([{ requestedAmount: "150" }, { requestedAmount: "150" }], 100)).toEqual({ requested: 300n, fee: 2n, net: 298n });
    expect(arrangementSplit([{ requestedAmount: "100000000000" }], 200)).toEqual({ requested: 100_000_000_000n, fee: 2_000_000_000n, net: 98_000_000_000n });
    expect(arrangementSplit([], 200)).toEqual({ requested: 0n, fee: 0n, net: 0n });
  });
});
