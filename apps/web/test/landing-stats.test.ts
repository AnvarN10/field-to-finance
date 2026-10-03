import { describe, expect, it } from "vitest";
import { landingStats } from "../src/lib/landing-stats";
import type { PoolView } from "../src/lib/chain/views";

const pool = (o: Partial<PoolView>): PoolView => ({
  address: "A", poolId: "1", issuer: "I", mint: "M", vault: "V", crop: "wheat", season: 2027,
  targetAmount: "2000000000", raisedAmount: "0", yieldBps: 800, premiumBps: 550,
  subscriptionCloseTs: 100, maturityTs: 200, projectCount: 1, disbursedCount: 0, settledCount: 0,
  status: "Draft", instrument: null, ...o,
});

describe("landingStats", () => {
  it("counts open pools, sums raised and features the open pool closing last", () => {
    const s = landingStats([
      pool({ poolId: "1", status: "Open", raisedAmount: "500000000", subscriptionCloseTs: 100 }),
      pool({ poolId: "2", status: "Open", raisedAmount: "250000000", subscriptionCloseTs: 300 }),
      pool({ poolId: "3", status: "Redeeming", raisedAmount: "1000000000" }),
    ]);
    expect(s).toMatchObject({ openPools: 2, totalRaised: "1750000000" });
    expect(s.featured?.poolId).toBe("2");
  });

  it("falls back to the newest pool, or null", () => {
    expect(landingStats([pool({ poolId: "4", status: "Funded" }), pool({ poolId: "9", status: "Draft" })]).featured?.poolId).toBe("9");
    expect(landingStats([]).featured).toBeNull();
  });
});
