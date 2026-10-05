import { describe, expect, it } from "vitest";
import { termDefaults } from "../src/lib/term-defaults";

describe("termDefaults", () => {
  it("picks the largest round nominal that divides the amount and caps the fee", () => {
    expect(termDefaults({ crop: "wheat", season: 2027, requestedUsd: 1_000_000, proposedCouponBps: 1200 }, 500)).toMatchObject({ name: "Wheat 2027 harvest", symbol: "WHE27", unitNominalUsd: 100_000, arrangementFeeBps: 200 });
    expect(termDefaults({ crop: "barley", season: 2027, requestedUsd: 75_000, proposedCouponBps: 0 }, null)).toMatchObject({ unitNominalUsd: 25_000, arrangementFeeBps: 0 });
    expect(termDefaults({ crop: "wheat", season: 2027, requestedUsd: 1_234, proposedCouponBps: 0 }, 100).unitNominalUsd).toBe(1);
  });
});
