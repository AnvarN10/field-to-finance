import { describe, expect, it } from "vitest";
import {
  explorerAddress,
  explorerTx,
  formatDateUtc,
  formatHa,
  formatTonnes,
  formatUsd,
  formatYield,
  parseUsd,
  relativeTime,
  shortKey,
  withYield,
} from "../src/lib/format";

describe("money", () => {
  it("formats base units as USD", () => {
    expect(formatUsd(1_250_000_000n)).toBe("$1,250.00");
    expect(formatUsd("2000000000")).toBe("$2,000.00");
    expect(formatUsd(0n)).toBe("$0.00");
    expect(formatUsd(999_995n)).toBe("$1.00");
    expect(formatUsd(1_234_567n)).toBe("$1.23");
    expect(formatUsd(2_500_600_000n, { cents: false })).toBe("$2,501");
  });

  it("parses dollar input exactly, without floats", () => {
    expect(parseUsd("1,000.50")).toBe(1_000_500_000n);
    expect(parseUsd("$250")).toBe(250_000_000n);
    expect(parseUsd(" 0.000001 ")).toBe(1n);
    expect(parseUsd("0.1")).toBe(100_000n);
  });

  it("rejects ambiguous or invalid dollar input", () => {
    for (const bad of ["", "-5", "1.0000001", "1e3", "abc", "1.2.3", "$"]) {
      expect(() => parseUsd(bad), bad).toThrow(RangeError);
    }
  });

  it("computes principal plus yield like the program (floor)", () => {
    expect(withYield(1_000_000_000n, 800)).toBe(1_080_000_000n);
    expect(withYield(1n, 800)).toBe(1n);
    expect(withYield(3n, 5_000)).toBe(4n);
  });

  it("formats yield with one decimal", () => {
    expect(formatYield(800)).toBe("8.0%");
    expect(formatYield(550)).toBe("5.5%");
  });
});

describe("units and time", () => {
  it("formats tonnes and hectares", () => {
    expect(formatTonnes("1500000")).toBe("1,500 t");
    expect(formatTonnes(120_500n)).toBe("120.5 t");
    expect(formatHa(7611)).toBe("76.11 ha");
  });

  it("formats dates in UTC and relative time", () => {
    expect(formatDateUtc(1_791_000_000)).toBe("Oct 3, 2026, 4:00 AM UTC");
    const now = 1_791_000_000_000;
    expect(relativeTime(1_791_000_240, now)).toBe("in 4 minutes");
    expect(relativeTime(1_791_000_000 - 3 * 3600, now)).toBe("3 hours ago");
    expect(relativeTime(1_791_000_000 + 2 * 86400, now)).toBe("in 2 days");
  });
});

describe("explorer links", () => {
  it("builds devnet links and short keys", () => {
    expect(explorerTx("5sig")).toBe("https://explorer.solana.com/tx/5sig?cluster=devnet");
    expect(explorerAddress("Abc", "devnet")).toBe("https://explorer.solana.com/address/Abc?cluster=devnet");
    expect(explorerTx("5sig", "localnet")).toBe(
      "https://explorer.solana.com/tx/5sig?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899",
    );
    expect(shortKey("9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm")).toBe("9syr…6Jfm");
    expect(shortKey("short")).toBe("short");
  });
});

describe("formatUsdDown", () => {
  it("rounds payouts down to the cent, so the page never promises more than the program pays", async () => {
    const { formatUsdDown } = await import("../src/lib/format");
    expect(formatUsdDown(1_041_666_666_666n)).toBe("$1,041,666.66");
    expect(formatUsdDown(104_166_666_666n)).toBe("$104,166.66");
    expect(formatUsdDown(1_000_000n)).toBe("$1.00");
  });
});
