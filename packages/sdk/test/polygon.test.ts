import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical";
import { PolygonFormatError, normalizePolygon, polygonHashHex } from "../src/polygon";

const SQUARE = {
  type: "Polygon",
  coordinates: [[[69, 52], [69.01, 52], [69.01, 52.01], [69, 52.01], [69, 52]]],
};

describe("normalizePolygon", () => {
  it("produces the canonical form that is hashed", () => {
    expect(canonicalJson(normalizePolygon(SQUARE))).toBe(
      '{"coordinates":[[[69,52],[69.01,52],[69.01,52.01],[69,52.01],[69,52]]],"type":"Polygon"}',
    );
  });

  it("gives the same hash for a Feature, a one-feature FeatureCollection and the bare geometry", () => {
    const feature = { type: "Feature", properties: { name: "pilot-1" }, geometry: SQUARE };
    const collection = { type: "FeatureCollection", features: [feature] };
    expect(polygonHashHex(feature)).toBe(polygonHashHex(SQUARE));
    expect(polygonHashHex(collection)).toBe(polygonHashHex(SQUARE));
  });

  it("drops altitude, closes an open ring and rounds to 7 decimals", () => {
    const messy = {
      type: "Polygon",
      coordinates: [[[69.00000001, 52, 310], [69.01, 52, 305], [69.01, 52.01], [69, 52.01]]],
    };
    expect(polygonHashHex(messy)).toBe(polygonHashHex(SQUARE));
  });

  it("changes the hash when the boundary changes", () => {
    const moved = { ...SQUARE, coordinates: [[[69, 52], [69.02, 52], [69.02, 52.01], [69, 52.01], [69, 52]]] };
    expect(polygonHashHex(moved)).not.toBe(polygonHashHex(SQUARE));
  });

  it("rejects non-Polygon geometries and malformed rings", () => {
    expect(() => normalizePolygon({ type: "MultiPolygon", coordinates: [] })).toThrow(PolygonFormatError);
    expect(() => normalizePolygon({ type: "FeatureCollection", features: [{}, {}] })).toThrow(/exactly one/);
    expect(() => normalizePolygon({ type: "Polygon", coordinates: [[[69, 52], [69.01, 52], [69, 52]]] })).toThrow(/at least 4/);
    expect(() => normalizePolygon({ type: "Polygon", coordinates: [[[69, "52"], [69.01, 52], [69.01, 52.01], [69, 52]]] })).toThrow(/lon, lat/);
  });
});
