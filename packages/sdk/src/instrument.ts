import { canonicalJson, sha256 } from "./canonical";
import type { SettlementElectionName, SettlementModeName } from "./enums";

/** Mirror anchor/programs/f2f/src/constants.rs. */
export const MAX_COUPON_BPS = 3_000;
export const MAX_TERM_DAYS = 1_830;
export const MAX_TOKENIZED_SHARE_BPS = 3_000;
export const MAX_SHORT_STR_LEN = 32;
const SECONDS_PER_DAY = 86_400;
const ACT360_DENOM = 10_000n * 360n;

/** Whole days from start to maturity, like `math::actual_days`. */
export function actualDays(startTs: number, maturityTs: number): number {
  if (maturityTs < startTs) throw new RangeError("maturity is before the interest start");
  return Math.floor((maturityTs - startTs) / SECONDS_PER_DAY);
}

/** `amount × (1 + coupon_bps / 10_000 × days / 360)`, rounded down, like `math::with_coupon`. */
export function withCoupon(amount: bigint, couponBps: number, days: number): bigint {
  return (amount * (ACT360_DENOM + BigInt(couponBps) * BigInt(days))) / ACT360_DENOM;
}

/** Cash due for `amount` principal at redemption, like `instrument::redemption_due`. */
export function redemptionDue(
  amount: bigint,
  pool: { yieldBps: number; maturityTs: number },
  terms: { couponBpsAnnual: number; startTs: number } | null,
): bigint {
  if (terms) return withCoupon(amount, terms.couponBpsAnnual, actualDays(terms.startTs, pool.maturityTs));
  return (amount * (10_000n + BigInt(pool.yieldBps))) / 10_000n;
}

/** Whole tokens in `amount` base units (1 token = `unitNominal` base units). */
export const tokensFromAmount = (amount: bigint, unitNominal: bigint): bigint => amount / unitNominal;

export const tokenizedKg = (volumeKg: bigint, shareBps: number): bigint => (volumeKg * BigInt(shareBps)) / 10_000n;

/** Kilograms claimed by burning `amount`, like `redeem_delivery`: amount × tokenized kg / raised, floored. */
export const grainClaimKg = (amount: bigint, tokenizedKgTotal: bigint, raised: bigint): bigint =>
  raised === 0n ? 0n : (amount * tokenizedKgTotal) / raised;

/** Settlement that applies at `now`, like `InstrumentTerms::effective_election`. */
export function effectiveElection(
  terms: { settlementMode: SettlementModeName; election: SettlementElectionName | null },
  now: number,
  maturityTs: number,
): SettlementElectionName | null {
  if (terms.settlementMode === "CashBuyback") return "Buyback";
  if (terms.settlementMode === "GrainDelivery") return "Delivery";
  return terms.election ?? (now > maturityTs ? "Delivery" : null);
}

export type QualityParameter = { key: string; label: string; requirement: string };
export type QualitySpec = { version: 1; crop: string; class: string; parameters: QualityParameter[] };

/** The twelve standardized commodity terms of the pilot term sheet (raw/pilot-digital-asset-contract-2026-10.csv). */
export const PILOT_QUALITY_SPEC: QualitySpec = {
  version: 1,
  crop: "wheat",
  class: "HiPro (class 3)",
  parameters: [
    { key: "crop", label: "Crop", requirement: "Wheat" },
    { key: "class", label: "Class", requirement: "HiPro (class 3)" },
    { key: "gluten", label: "Gluten", requirement: "≥ 30%" },
    { key: "protein", label: "Protein", requirement: "≥ 15%" },
    { key: "moisture", label: "Moisture", requirement: "14% (12%)" },
    { key: "falling_number", label: "Falling number", requirement: "≥ 200 s" },
    { key: "test_weight", label: "Test weight", requirement: "≥ 750 g/l" },
    { key: "impurities", label: "Impurities", requirement: "≤ 2%" },
    { key: "odour", label: "Odour", requirement: "None" },
    { key: "gluten_deformation_index", label: "Gluten deformation index", requirement: "≤ 75 units" },
    { key: "vitreousness", label: "Vitreousness", requirement: "≥ 50%" },
    { key: "pests", label: "Pest infestation", requirement: "None" },
  ],
};

/** SHA-256 of the canonical JSON; stored on-chain as `quality_spec_hash`, the JSON in the bucket. */
export const qualitySpecHash = (spec: QualitySpec): Uint8Array => sha256(canonicalJson(spec));
