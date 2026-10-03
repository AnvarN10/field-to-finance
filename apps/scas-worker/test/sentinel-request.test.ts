import { describe, expect, it } from "vitest";
import { EVALSCRIPT } from "../src/sentinel/evalscript";
import { CRS_WGS84, buildStatsRequest, resolutionDegrees, windowEndingAt } from "../src/sentinel/request";
import { SQUARE } from "./helpers";

describe("windowEndingAt", () => {
  it("covers whole UTC days and ends after the as-of day", () => {
    expect(windowEndingAt(new Date("2026-10-03T15:00:00Z"), 90)).toEqual({
      from: "2026-07-06T00:00:00Z",
      to: "2026-10-04T00:00:00Z",
    });
  });
});

describe("resolutionDegrees", () => {
  it("is about 10 m at the field's latitude", () => {
    expect(resolutionDegrees(52.005)).toEqual({ resx: 0.00014593, resy: 0.00008983 });
  });
});

describe("buildStatsRequest", () => {
  it("asks for daily Sentinel-2 L2A statistics over the polygon in WGS84", () => {
    const window = { from: "2026-07-06T00:00:00Z", to: "2026-10-04T00:00:00Z" };
    const req = buildStatsRequest(SQUARE, window);
    expect(req.input.bounds.geometry).toEqual(SQUARE);
    expect(req.input.bounds.properties.crs).toBe(CRS_WGS84);
    expect(req.input.data[0]).toEqual({
      type: "sentinel-2-l2a",
      dataFilter: { maxCloudCoverage: 80, mosaickingOrder: "leastCC" },
    });
    expect(req.aggregation.timeRange).toEqual(window);
    expect(req.aggregation.aggregationInterval).toEqual({ of: "P1D" });
    expect(req.aggregation.evalscript).toBe(EVALSCRIPT);
    expect(req.aggregation.resx).toBeCloseTo(0.000146, 6);
  });

  it("masks clouds with SCL and emits separate footprint and ndvi masks", () => {
    expect(EVALSCRIPT).toContain('"SCL"');
    expect(EVALSCRIPT).toContain('bands: ["ndvi", "footprint"]');
    expect(EVALSCRIPT).toContain("[0, 1, 3, 8, 9, 10, 11]");
  });
});
