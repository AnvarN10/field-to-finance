import { describe, expect, it } from "vitest";
import { createPoolInput } from "../src/lib/chain/admin-ops";
import { PILOT_ISSUE_USD, PILOT_SAMPLE_FIELDS, pilotPoolInput, pilotSchedule } from "../src/lib/demo/pilot-flow";
import { checkPolygon } from "../src/lib/geometry";
import { normalizePolygon } from "@f2f/sdk";

describe("pilot demo flow", () => {
  it("matches the term sheet: $1,000,000 in ten $100,000 tokens, 5% Act/360, hybrid, 10,000 t, 30%", () => {
    const input = createPoolInput.parse(pilotPoolInput("12", "issuer1111111111111111111111111111111111111", "demo"));
    expect(PILOT_ISSUE_USD).toBe(1_000_000);
    expect(input.instrument).toMatchObject({ unitNominalUsd: 100_000, couponBps: 500, settlementMode: "Hybrid", volumeTonnes: 10_000, tokenizedShareBps: 3_000, elevator: "Ust-Kamenogorsk", lab: "Baltic Control" });
    // A minutes-long demo backdates the interest start so 300 days of coupon accrue.
    expect(input.instrument?.interestDays).toBe(300);
    expect(input.maturityInMinutes).toBeGreaterThan(input.closeInMinutes);
  });

  it("keeps the standing pilot pool open with interest from subscription close", () => {
    const input = createPoolInput.parse(pilotPoolInput("13", "issuer1111111111111111111111111111111111111", "seed"));
    expect(input.instrument?.interestDays).toBeUndefined();
    expect(input.closeInMinutes).toBeGreaterThanOrEqual(7 * 24 * 60);
    expect(input.name).toMatch(/sample fields/i);
    expect(pilotSchedule("seed").maturityInMinutes).toBeLessThanOrEqual(60 * 24 * 365);
  });

  it("ships clearly labelled sample polygons that pass the field checks", () => {
    expect(PILOT_SAMPLE_FIELDS.length).toBeGreaterThan(0);
    for (const f of PILOT_SAMPLE_FIELDS) {
      expect(f.name).toMatch(/^Sample/);
      expect(checkPolygon(normalizePolygon(f.geojson)).valid).toBe(true);
    }
  });
});
