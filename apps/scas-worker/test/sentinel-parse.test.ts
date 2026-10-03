import { describe, expect, it } from "vitest";
import { SentinelError } from "../src/errors";
import { parseStats } from "../src/sentinel/parse";
import clear from "./fixtures/stats-clear.json";
import cloudy from "./fixtures/stats-cloudy.json";
import empty from "./fixtures/stats-empty.json";
import partial from "./fixtures/stats-partial-error.json";

describe("parseStats", () => {
  it("turns daily intervals into observations and skips days without acquisition", () => {
    const parsed = parseStats(clear);
    expect(parsed.polygonPixels).toBe(1000);
    expect(parsed.observations).toEqual([
      { date: "2026-09-10", ndviMean: 0.21, clearPixels: 950, footprintPixels: 1000, clearRatio: 0.95 },
      { date: "2026-09-15", ndviMean: 0.3, clearPixels: 100, footprintPixels: 1000, clearRatio: 0.1 },
      { date: "2026-09-20", ndviMean: 0.19, clearPixels: 990, footprintPixels: 1000, clearRatio: 0.99 },
    ]);
    expect(parsed.failedIntervals).toEqual([]);
  });

  it("reports NaN means as null", () => {
    const parsed = parseStats(cloudy);
    expect(parsed.observations.map((o) => [o.clearRatio, o.ndviMean])).toEqual([
      [0.5, 0.25],
      [0, null],
    ]);
  });

  it("returns no observations for an empty response", () => {
    expect(parseStats(empty)).toEqual({ observations: [], failedIntervals: [], polygonPixels: 0 });
  });

  it("records failed intervals and keeps the rest", () => {
    const parsed = parseStats(partial);
    expect(parsed.failedIntervals).toEqual([{ date: "2026-07-08", error: "Failed to process the interval" }]);
    expect(parsed.observations).toHaveLength(1);
  });

  it("throws when every interval failed", () => {
    const allFailed = { data: [partial.data[0]] };
    expect(() => parseStats(allFailed)).toThrow(SentinelError);
  });

  it("throws on a response that does not have the documented shape", () => {
    expect(() => parseStats({ error: { status: 400 } })).toThrow(/unexpected Statistical API response/);
  });
});
