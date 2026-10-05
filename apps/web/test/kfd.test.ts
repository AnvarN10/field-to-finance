import { describe, expect, it } from "vitest";
import { buildKfd, kfdHash } from "../src/lib/kfd";

const detail = {
  pool: { address: "Poo1A111111111111111111111111111111111111", poolId: "7", issuer: "Issuer11111111111111111111111111111111111", targetAmount: "1000000000000", yieldBps: 1200, maturityTs: 1_900_000_000, subscriptionCloseTs: 1_850_000_000, instrument: { symbol: "DWHT27", name: "Demo wheat 2027" } },
  terms: { unitNominal: "100000000000", couponBpsAnnual: 1200, dayCount: "Act360", startTs: 1_850_000_000, settlementMode: "Hybrid", volumeKg: "10000000", tokenizedShareBps: 3000, elevator: "Demo elevator", lab: "Demo lab" },
  arrangementFeeBps: 200,
} as never;

describe("key features document", () => {
  it("states the instrument, terms, fees and risks in plain words", () => {
    const k = buildKfd(detail, "500000");
    expect(k.title).toBe("Key features: DWHT27");
    expect(k.items.map((i) => i.label)).toEqual(expect.arrayContaining(["Issuer of record", "Instrument", "Nominal per token", "Coupon", "Maturity", "Settlement", "Fees"]));
    expect(k.risks.length).toBeGreaterThanOrEqual(4);
  });

  it("hashes deterministically and changes when the terms change", () => {
    const a = kfdHash(buildKfd(detail, "500000"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(kfdHash(buildKfd(detail, "500000"))).toBe(a);
    const changed = { ...(detail as object), terms: { ...(detail as { terms: object }).terms, couponBpsAnnual: 1300 } } as never;
    expect(kfdHash(buildKfd(changed, "500000"))).not.toBe(a);
  });

  it("covers pools without term-sheet terms with the flat yield", () => {
    const k = buildKfd({ ...(detail as object), terms: null } as never, null);
    expect(k.items.find((i) => i.label === "Return")?.value).toMatch(/Fixed yield 12.0%/);
  });
});
