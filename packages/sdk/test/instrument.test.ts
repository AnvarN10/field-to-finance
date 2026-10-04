import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
  ATTESTATION_KINDS,
  DAY_COUNTS,
  F2F_IDL,
  PILOT_QUALITY_SPEC,
  SETTLEMENT_ELECTIONS,
  SETTLEMENT_MODES,
  actualDays,
  effectiveElection,
  electionFromAnchor,
  grainClaimKg,
  instrumentPda,
  qualitySpecHash,
  redemptionDue,
  settlementModeFromAnchor,
  tokenizedKg,
  tokensFromAmount,
  withCoupon,
} from "../src";

const USDC = 1_000_000n;
const DAY = 86_400;

describe("Act/360 coupon", () => {
  it("matches the pilot term sheet: $1,000,000 at 5% for 300 days", () => {
    expect(withCoupon(1_000_000n * USDC, 500, 300)).toBe(1_041_666_666_666n);
    expect(withCoupon(100_000n * USDC, 500, 360)).toBe(105_000n * USDC);
  });

  it("counts whole days and refuses a start after maturity", () => {
    expect(actualDays(1_800_000_000, 1_800_000_000 + 300 * DAY + 86_399)).toBe(300);
    expect(() => actualDays(10, 9)).toThrow(RangeError);
  });

  it("uses the coupon when terms exist and the flat yield otherwise, like the program", () => {
    const pool = { yieldBps: 1_200, maturityTs: 1_800_000_000 + 300 * DAY };
    expect(redemptionDue(1_000_000n * USDC, pool, { couponBpsAnnual: 500, startTs: 1_800_000_000 })).toBe(1_041_666_666_666n);
    expect(redemptionDue(100_000n * USDC, pool, null)).toBe(112_000n * USDC);
  });
});

describe("tokens and grain", () => {
  it("converts base units to whole tokens of the nominal", () => {
    expect(tokensFromAmount(1_000_000n * USDC, 100_000n * USDC)).toBe(10n);
    expect(tokensFromAmount(150_000n * USDC, 100_000n * USDC)).toBe(1n);
  });

  it("computes the pro-rata grain claim like redeem_delivery", () => {
    const kg = tokenizedKg(10_000_000n, 3_000);
    expect(kg).toBe(3_000_000n);
    expect(grainClaimKg(300_000n * USDC, kg, 1_000_000n * USDC)).toBe(900_000n);
  });
});

describe("settlement election", () => {
  const maturity = 1_000;
  it("follows the mode, then the hybrid election, then delivery after maturity", () => {
    expect(effectiveElection({ settlementMode: "CashBuyback", election: null }, 0, maturity)).toBe("Buyback");
    expect(effectiveElection({ settlementMode: "GrainDelivery", election: null }, 0, maturity)).toBe("Delivery");
    expect(effectiveElection({ settlementMode: "Hybrid", election: null }, maturity, maturity)).toBeNull();
    expect(effectiveElection({ settlementMode: "Hybrid", election: null }, maturity + 1, maturity)).toBe("Delivery");
    expect(effectiveElection({ settlementMode: "Hybrid", election: "Buyback" }, maturity + 1, maturity)).toBe("Buyback");
  });

  it("decodes Anchor enums", () => {
    expect(settlementModeFromAnchor({ hybrid: {} })).toBe("Hybrid");
    expect(electionFromAnchor({ delivery: {} })).toBe("Delivery");
  });
});

describe("enums and IDL agree", () => {
  const variants = (name: string) =>
    (F2F_IDL.types as unknown as { name: string; type: { variants?: { name: string }[] } }[])
      .find((t) => t.name === name)!
      .type.variants!.map((v) => v.name);

  it("mirrors every enum in the program, in order", () => {
    expect([...ATTESTATION_KINDS]).toEqual(variants("AttestationKind"));
    expect([...SETTLEMENT_MODES]).toEqual(variants("SettlementMode"));
    expect([...SETTLEMENT_ELECTIONS]).toEqual(variants("SettlementElection"));
    expect([...DAY_COUNTS]).toEqual(variants("DayCount"));
  });

  it("derives the InstrumentTerms address", () => {
    const programId = new PublicKey(F2F_IDL.address);
    const pool = PublicKey.unique();
    const [expected] = PublicKey.findProgramAddressSync([Buffer.from("instrument"), pool.toBuffer()], programId);
    expect(instrumentPda(programId, pool).equals(expected)).toBe(true);
  });
});

describe("quality spec", () => {
  it("lists the twelve commodity parameters of the term sheet", () => {
    expect(PILOT_QUALITY_SPEC.parameters).toHaveLength(12);
    expect(PILOT_QUALITY_SPEC.parameters.map((p) => p.key)).toContain("protein");
  });

  it("hashes the canonical JSON so key order does not matter", () => {
    const a = qualitySpecHash(PILOT_QUALITY_SPEC);
    const { parameters, ...rest } = PILOT_QUALITY_SPEC;
    const reordered = { parameters, ...rest };
    expect(qualitySpecHash(reordered)).toEqual(a);
    expect(a).toHaveLength(32);
  });
});
