import { describe, expect, it } from "vitest";
import { GeoJsonInputError, MAX_FIELDS_PER_UPLOAD, splitFeatures } from "../src/lib/geojson";
import { FIELD_A, FIELD_B, MULTI } from "./fixtures/polygons";

describe("splitFeatures", () => {
  it("turns a FeatureCollection into one item per field", () => {
    expect(splitFeatures({ type: "FeatureCollection", features: [FIELD_A, FIELD_B] })).toHaveLength(2);
  });

  it("accepts a bare Feature or Polygon", () => {
    expect(splitFeatures(FIELD_A)).toEqual([FIELD_A]);
    expect(splitFeatures(FIELD_A.geometry)).toEqual([FIELD_A.geometry]);
  });

  it("rejects MultiPolygon with a message that says what to do", () => {
    expect(() => splitFeatures(MULTI)).toThrow(/MultiPolygon.*one Polygon per field/);
    expect(() => splitFeatures({ type: "FeatureCollection", features: [{ type: "Feature", geometry: MULTI }] })).toThrow(GeoJsonInputError);
  });

  it("rejects empty, non-GeoJSON and too many fields", () => {
    expect(() => splitFeatures({ type: "FeatureCollection", features: [] })).toThrow(/no fields/);
    expect(() => splitFeatures("hello")).toThrow(GeoJsonInputError);
    const many = Array.from({ length: MAX_FIELDS_PER_UPLOAD + 1 }, () => FIELD_A);
    expect(() => splitFeatures({ type: "FeatureCollection", features: many })).toThrow(/at most 4/);
  });
});
