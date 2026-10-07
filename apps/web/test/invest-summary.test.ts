import { describe, expect, it } from "vitest";
import { summarize } from "../src/lib/invest-summary";

const row = (over: Record<string, unknown>) => ({ poolId: "1", symbol: "S", wallet: "w", tokens: "1", holding: "100000000", accrued: "1000000", atMaturity: "112000000", maturityTs: 2_000, settlement: "", grainClaimKg: null, action: "View pool", ...over }) as never;

describe("summarize", () => {
  it("totals value at maturity, accrued coupon and USDC; next payment is the earliest future maturity", () => {
    const s = summarize({ positions: [row({}), row({ poolId: "2", maturityTs: 1_500, atMaturity: "50000000", accrued: null }), row({ poolId: "3", maturityTs: 500, atMaturity: "7000000" })], states: [{ usdcBalance: "5000000" }, null] }, 1_000);
    expect(s.atMaturity).toBe(169_000_000n);
    expect(s.accrued).toBe(2_000_000n);
    expect(s.usdc).toBe(5_000_000n);
    expect(s.next).toEqual({ ts: 1_500, amount: 50_000_000n });
    expect(s.upcoming.map((u) => u.ts)).toEqual([1_500, 2_000]);
  });

  it("is empty without positions", () => {
    expect(summarize({ positions: [], states: [] }, 1)).toEqual({ atMaturity: 0n, accrued: 0n, usdc: 0n, next: null, upcoming: [] });
  });
});
