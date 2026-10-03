import { normalizePolygon } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import { areaMismatch, checkPolygon } from "../src/geometry";
import { BOWTIE, SQUARE } from "./helpers";

describe("checkPolygon", () => {
  it("accepts a simple field and computes geodesic hectares", () => {
    const check = checkPolygon(SQUARE);
    expect(check.valid).toBe(true);
    expect(check.areaHa).toBeCloseTo(76.11, 2);
    expect(check.reasons).toEqual([]);
  });

  it("accepts a field with a hole and subtracts it", () => {
    const holed = normalizePolygon({
      type: "Polygon",
      coordinates: [
        [[69, 52], [69.01, 52], [69.01, 52.01], [69, 52.01], [69, 52]],
        [[69.002, 52.002], [69.002, 52.004], [69.004, 52.004], [69.004, 52.002], [69.002, 52.002]],
      ],
    });
    const check = checkPolygon(holed);
    expect(check.valid).toBe(true);
    expect(check.areaHa).toBeCloseTo(73.07, 1);
  });

  it("rejects a self-intersecting boundary", () => {
    const check = checkPolygon(BOWTIE);
    expect(check.valid).toBe(false);
    expect(check.reasons).toContain("polygon boundary self-intersects");
  });

  it("rejects coordinates outside lon/lat bounds", () => {
    const bad = normalizePolygon({ type: "Polygon", coordinates: [[[200, 52], [201, 52], [201, 53], [200, 52]]] });
    expect(checkPolygon(bad).valid).toBe(false);
  });

  it("rejects areas too large for a single field", () => {
    const huge = normalizePolygon({ type: "Polygon", coordinates: [[[69, 52], [71, 52], [71, 54], [69, 54], [69, 52]]] });
    const check = checkPolygon(huge);
    expect(check.valid).toBe(false);
    expect(check.reasons[0]).toMatch(/exceeds 20000 ha/);
  });
});

describe("areaMismatch", () => {
  it("is the relative difference to the declared area", () => {
    expect(areaMismatch(105, 100)).toBe(0.05);
    expect(areaMismatch(90, 100)).toBeCloseTo(0.1);
  });
});
