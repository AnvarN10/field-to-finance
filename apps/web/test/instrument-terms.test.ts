import { describe, expect, it } from "vitest";
import type { InstrumentTermsView, PoolView } from "../src/lib/chain/views";
import { panelMode } from "../src/lib/invest";
import {
  claimableKg,
  couponLabel,
  instrumentTypeLabel,
  interestDays,
  payoutForTokens,
  settlementStatus,
  tokenCount,
  validateTokenSubscription,
} from "../src/lib/instrument-terms";

const NOMINAL = 100_000_000_000n;
const terms = (o: Partial<InstrumentTermsView> = {}): InstrumentTermsView => ({
  unitNominal: NOMINAL.toString(),
  couponBpsAnnual: 500,
  dayCount: "Act360",
  startTs: 1_000_000,
  settlementMode: "Hybrid",
  volumeKg: "10000000",
  tokenizedShareBps: 3_000,
  qualitySpecHash: "ab".repeat(32),
  specUri: "",
  elevator: "Ust-Kamenogorsk",
  lab: "Baltic Control",
  election: null,
  electedAt: 0,
  receiptHash: null,
  labCertHash: null,
  labPassed: false,
  deliveredKg: "0",
  ...o,
});
const pool = (o: Partial<PoolView> = {}) =>
  ({
    status: "Open",
    subscriptionCloseTs: 2_000_000,
    maturityTs: 1_000_000 + 300 * 86_400,
    targetAmount: (10n * NOMINAL).toString(),
    raisedAmount: "0",
    yieldBps: 1_200,
    terms: terms(),
    ...o,
  }) as PoolView;

describe("term sheet numbers", () => {
  it("counts tokens and the Act/360 payout per token", () => {
    expect(tokenCount(pool().targetAmount, terms())).toBe(10n);
    expect(interestDays(pool(), terms())).toBe(300);
    expect(payoutForTokens(pool(), terms(), 1n)).toBe(104_166_666_666n);
    expect(couponLabel(terms())).toBe("5.0% a year, Act/360");
  });

  it("names the instrument type of each settlement mode", () => {
    expect(instrumentTypeLabel("Hybrid")).toBe("Hybrid: grain delivery with the issuer's right to buy the token back");
    expect(instrumentTypeLabel("CashBuyback")).toMatch(/cash/i);
    expect(instrumentTypeLabel("GrainDelivery")).toMatch(/grain delivery/i);
  });
});

describe("validateTokenSubscription", () => {
  const w = { networkFee: 500_000n, usdcBalance: 1_000_000_000_000n };
  it("buys whole tokens up to the remaining tokens and adds the network fee", () => {
    expect(validateTokenSubscription("2", NOMINAL, 10n * NOMINAL, w)).toEqual({ ok: true, amount: 2n * NOMINAL, total: 2n * NOMINAL + 500_000n });
  });

  it("explains fractions, zero, capacity and balance", () => {
    expect(validateTokenSubscription("1.5", NOMINAL, 10n * NOMINAL, w)).toMatchObject({ ok: false, reason: "amount", message: "Enter a whole number of tokens" });
    expect(validateTokenSubscription("0", NOMINAL, 10n * NOMINAL, w)).toMatchObject({ ok: false, reason: "amount" });
    expect(validateTokenSubscription("11", NOMINAL, 10n * NOMINAL, w)).toMatchObject({ ok: false, message: "The pool has 10 tokens left" });
    expect(validateTokenSubscription("1", NOMINAL, 10n * NOMINAL, { networkFee: 500_000n, usdcBalance: 1n })).toMatchObject({ ok: false, reason: "balance" });
  });
});

describe("settlement", () => {
  it("describes the election and the delivery default", () => {
    expect(settlementStatus(pool({ status: "Funded" }), terms(), 0).label).toMatch(/not elected yet/i);
    expect(settlementStatus(pool({ status: "Funded" }), terms({ election: "Buyback" }), 0).label).toMatch(/buyback/i);
    expect(settlementStatus(pool({ status: "Funded" }), terms(), pool().maturityTs + 1).election).toBe("Delivery");
    const lapsed = settlementStatus(pool({ status: "Funded" }), terms({ election: "Buyback" }), pool().maturityTs + 8 * 86_400);
    expect(lapsed.election).toBe("Delivery");
    expect(lapsed.label).toMatch(/not funded/i);
  });

  it("opens grain claims at maturity once the receipt and a passing lab certificate are in", () => {
    const delivered = terms({ election: "Delivery", receiptHash: "ef".repeat(32), labPassed: true });
    const funded = pool({ status: "Funded", raisedAmount: (10n * NOMINAL).toString(), terms: delivered });
    expect(panelMode(funded, funded.maturityTs)).toBe("deliver");
    expect(panelMode(funded, funded.maturityTs - 1)).toBe("closed-funded");
    expect(panelMode(pool({ status: "Funded", terms: terms({ election: "Delivery" }) }), pool().maturityTs)).toBe("closed-funded");
    expect(claimableKg(funded, delivered, 3n * NOMINAL)).toBe(900_000n);
  });
});

describe("disconnected invest copy", () => {
  it("speaks of whole tokens and the coupon on a term-sheet pool", async () => {
    const { disconnectedCopy } = await import("../src/lib/invest");
    const copy = disconnectedCopy("subscribe", 500, terms());
    expect(copy).toMatch(/tokens of \$100,000\.00/);
    expect(copy).toMatch(/5\.0% a year, Act\/360/);
    expect(copy).not.toMatch(/Fixed yield/);
  });
});
