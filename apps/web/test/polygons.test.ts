import { polygonHashHex } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import { checkPolygon } from "../src/lib/geometry";
import { loadPolygon, uploadPolygon } from "../src/lib/polygons";
import { MemoryStore, polygonKey } from "../src/lib/store";
import { BOWTIE, FIELD_A, MULTI } from "./fixtures/polygons";

describe("checkPolygon", () => {
  it("computes a geodesic area in hectares", () => {
    const c = checkPolygon(FIELD_A.geometry as never);
    expect(c.valid).toBe(true);
    expect(c.areaHa).toBeGreaterThan(55);
    expect(c.areaHa).toBeLessThan(57);
  });

  it("rejects a self-crossing boundary", () => {
    expect(checkPolygon(BOWTIE as never)).toMatchObject({ valid: false, problems: ["the boundary crosses itself"] });
  });

  it("rejects coordinates outside WGS84 ranges", () => {
    const bad = { type: "Polygon", coordinates: [[[200, 53], [201, 53], [201, 54], [200, 53]]] };
    expect(checkPolygon(bad as never).problems[0]).toMatch(/longitude, latitude/);
  });
});

describe("uploadPolygon", () => {
  it("stores the canonical polygon under the sdk polygon hash", async () => {
    const store = new MemoryStore();
    const up = await uploadPolygon(store, FIELD_A);
    expect(up.polygonHash).toBe(polygonHashHex(FIELD_A));
    expect(up.areaHaX100).toBe(Math.round(up.areaHa * 100));
    expect(store.objects.has(polygonKey(up.polygonHash))).toBe(true);
    expect(await loadPolygon(store, up.polygonHash)).toEqual(up.polygon);
  });

  it("hashes altitude, unclosed rings and extra decimals the same way", async () => {
    const store = new MemoryStore();
    const ring = FIELD_A.geometry.coordinates[0] as number[][];
    const variant = {
      type: "Polygon",
      coordinates: [ring.slice(0, -1).map(([x, y]) => [(x as number) + 1e-9, y, 210])],
    };
    expect((await uploadPolygon(store, variant)).polygonHash).toBe((await uploadPolygon(store, FIELD_A)).polygonHash);
  });

  it("rejects malformed and invalid polygons with 422", async () => {
    const store = new MemoryStore();
    await expect(uploadPolygon(store, MULTI)).rejects.toMatchObject({ status: 422 });
    await expect(uploadPolygon(store, BOWTIE)).rejects.toMatchObject({ status: 422, message: "the boundary crosses itself" });
    await expect(uploadPolygon(store, null)).rejects.toMatchObject({ status: 422 });
    expect(store.objects.size).toBe(0);
  });
});
