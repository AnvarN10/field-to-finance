import { describe, expect, it } from "vitest";
import { accruedToDate, obligation } from "../src/lib/accrual";

const DAY = 86_400;
const terms = { couponBpsAnnual: 1200, startTs: 0, settlementMode: "Hybrid", election: null } as never;

describe("accruedToDate (Act/360)", () => {
  it("accrues 12% on $1,000,000 for 90 days to $30,000", () => expect(accruedToDate(1_000_000_000_000n, 1200, 0, 90 * DAY, 400 * DAY)).toBe(30_000_000_000n));
  it("is zero before interest starts", () => expect(accruedToDate(1_000_000n, 1200, 10 * DAY, 5 * DAY, 400 * DAY)).toBe(0n));
  it("stops at maturity", () => expect(accruedToDate(1_000_000_000_000n, 1200, 0, 900 * DAY, 90 * DAY)).toBe(30_000_000_000n));
  it("counts whole days only and rounds down", () => expect(accruedToDate(1_000_000n, 1200, 0, DAY + DAY - 1, 400 * DAY)).toBe(333n));
});

describe("obligation", () => {
  const pool = { raisedAmount: "1000000000000", yieldBps: 0, maturityTs: 90 * DAY } as never;
  it("computes due at maturity, accrual and the buyback shortfall from the vault", () => {
    const o = obligation({ pool, terms }, 10_000_000_000n, 30 * DAY);
    expect(o.principal).toBe(1_000_000_000_000n);
    expect(o.dueAtMaturity).toBe(1_030_000_000_000n);
    expect(o.accrued).toBe(10_000_000_000n);
    expect(o.buybackShortfall).toBe(1_020_000_000_000n);
  });
  it("shows no shortfall once the vault covers the amount due", () => {
    expect(obligation({ pool, terms }, 2_000_000_000_000n, 30 * DAY).buybackShortfall).toBe(0n);
  });
  it("uses the flat yield for pools without term-sheet terms and has no accrual", () => {
    const o = obligation({ pool: { raisedAmount: "1000000", yieldBps: 800, maturityTs: 10 } as never, terms: null }, 0n, 5);
    expect(o.dueAtMaturity).toBe(1_080_000n);
    expect(o.accrued).toBeNull();
  });
});
