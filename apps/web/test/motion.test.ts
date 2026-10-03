import { describe, expect, it } from "vitest";
import { formatUsd } from "../src/lib/format";
import { easeOutCubic, STAGGER_MAX_ITEMS, staggerDelay, TICKER_MS, usdTickerFrame } from "../src/lib/motion";

describe("usdTickerFrame", () => {
  it("starts at zero and lands exactly on the server-rendered value", () => {
    expect(usdTickerFrame("2250000000", 0, { cents: false })).toBe("$0");
    expect(usdTickerFrame("2250000000", 1, { cents: false })).toBe(formatUsd("2250000000", { cents: false }));
    expect(usdTickerFrame("250000000", 1.4)).toBe("$250.00");
  });

  it("only ever counts up", () => {
    let prev = -1n;
    for (let i = 0; i <= 30; i++) {
      const digits = BigInt(usdTickerFrame("123456789", i / 30).replace(/[$,.]/g, ""));
      expect(digits >= prev).toBe(true);
      prev = digits;
    }
  });

  it("runs for the style-lock ticker duration", () => {
    expect(TICKER_MS).toBe(900);
  });
});

describe("easeOutCubic", () => {
  it("clamps to [0, 1] and front-loads progress", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("staggerDelay", () => {
  it("steps 40ms and caps at the eighth item", () => {
    expect(staggerDelay(0)).toBe("0ms");
    expect(staggerDelay(2)).toBe("80ms");
    expect(staggerDelay(50)).toBe(`${(STAGGER_MAX_ITEMS - 1) * 40}ms`);
  });
});
