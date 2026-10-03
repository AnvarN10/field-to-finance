import { describe, expect, it } from "vitest";
import { RequestError } from "../src/errors";
import type { GeometryCheck } from "../src/geometry";
import { assertRuleApplicable, decide, type DecideInput } from "../src/rules/verdict";
import type { Observation } from "../src/sentinel/parse";

const VALID: GeometryCheck = { valid: true, areaHa: 100, reasons: [] };
const obs = (date: string, ndviMean: number | null, clearRatio = 0.95): Observation => ({
  date,
  ndviMean,
  clearRatio,
  clearPixels: Math.round(clearRatio * 1000),
  footprintPixels: 1000,
});
const input = (over: Partial<DecideInput>): DecideInput => ({
  kind: "FieldVerified",
  crop: "wheat",
  asOf: new Date("2026-10-03T09:00:00Z"),
  geometry: VALID,
  declaredAreaHa: 100,
  observations: [],
  ...over,
});

describe("FieldVerified", () => {
  it("passes with a valid polygon, matching area and a clear scene", () => {
    const d = decide(input({ declaredAreaHa: 104, observations: [obs("2026-09-10", 0.21), obs("2026-09-20", 0.19)] }));
    expect(d).toMatchObject({ verdict: "Pass", ndviMean: 0.19, sceneDate: "2026-09-20" });
  });

  it("passes at exactly 5% area difference and counts exactly 70% clear as clear", () => {
    const d = decide(input({ geometry: { ...VALID, areaHa: 105 }, observations: [obs("2026-09-10", 0.2, 0.7)] }));
    expect(d.verdict).toBe("Pass");
  });

  it("fails on an area mismatch above 5% even with clear scenes", () => {
    const d = decide(input({ declaredAreaHa: 90, observations: [obs("2026-09-20", 0.19)] }));
    expect(d.verdict).toBe("Fail");
    expect(d.reasons[0]).toMatch(/differs from declared 90 ha by 11\.1%/);
  });

  it("fails on an invalid polygon", () => {
    const d = decide(input({ geometry: { valid: false, areaHa: 0, reasons: ["polygon boundary self-intersects"] } }));
    expect(d).toMatchObject({ verdict: "Fail", reasons: ["polygon boundary self-intersects"] });
  });

  it("gives InsufficientData when only cloudy scenes exist", () => {
    const d = decide(input({ observations: [obs("2026-09-12", 0.25, 0.5), obs("2026-09-22", null, 0)] }));
    expect(d).toMatchObject({ verdict: "InsufficientData", ndviMean: null, sceneDate: null });
  });

  it("gives InsufficientData when there are no scenes", () => {
    expect(decide(input({})).verdict).toBe("InsufficientData");
  });
});

describe("season kinds (wheat, northern Kazakhstan)", () => {
  it("Vegetation passes inside the July range and fails below it", () => {
    const asOf = new Date("2026-07-12T12:00:00Z");
    expect(decide(input({ kind: "Vegetation", asOf, observations: [obs("2026-07-10", 0.72)] })).verdict).toBe("Pass");
    expect(decide(input({ kind: "Vegetation", asOf, observations: [obs("2026-07-10", 0.3)] })).verdict).toBe("Fail");
  });

  it("Sowing passes for bare or emerging soil and fails for dense vegetation", () => {
    const asOf = new Date("2026-05-30T12:00:00Z");
    expect(decide(input({ kind: "Sowing", asOf, observations: [obs("2026-05-25", 0.18)] })).verdict).toBe("Pass");
    expect(decide(input({ kind: "Sowing", asOf, observations: [obs("2026-05-25", 0.7)] })).verdict).toBe("Fail");
  });

  it("Harvest passes when NDVI drops after the season peak", () => {
    const asOf = new Date("2026-09-10T12:00:00Z");
    const series = [obs("2026-07-15", 0.78), obs("2026-08-20", 0.55), obs("2026-09-05", 0.24)];
    expect(decide(input({ kind: "Harvest", asOf, observations: series }))).toMatchObject({
      verdict: "Pass",
      ndviMean: 0.24,
      sceneDate: "2026-09-05",
    });
  });

  it("Harvest fails without a drop and needs two clear scenes", () => {
    const asOf = new Date("2026-09-10T12:00:00Z");
    const noDrop = [obs("2026-07-15", 0.78), obs("2026-09-05", 0.7)];
    expect(decide(input({ kind: "Harvest", asOf, observations: noDrop })).verdict).toBe("Fail");
    expect(decide(input({ kind: "Harvest", asOf, observations: [obs("2026-09-05", 0.24)] })).verdict).toBe(
      "InsufficientData",
    );
  });
});

describe("assertRuleApplicable", () => {
  it("allows FieldVerified for any crop", () => {
    expect(() => assertRuleApplicable("FieldVerified", "cotton", new Date("2026-10-03"))).not.toThrow();
  });

  it("refuses season kinds outside the crop calendar or for unknown crops", () => {
    expect(() => assertRuleApplicable("Vegetation", "wheat", new Date("2026-10-03"))).toThrow(RequestError);
    expect(() => assertRuleApplicable("Sowing", "cotton", new Date("2026-05-20"))).toThrow(/no crop calendar/);
    expect(() => assertRuleApplicable("Vegetation", "Wheat", new Date("2026-07-12"))).not.toThrow();
  });
});
