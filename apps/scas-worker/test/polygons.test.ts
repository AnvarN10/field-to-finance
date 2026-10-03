import { polygonHashHex } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import { polygonKey } from "../src/evidence";
import { uploadPolygon } from "../src/polygons";
import { MemoryStore } from "../src/store";
import { BOWTIE, SQUARE } from "./helpers";

describe("uploadPolygon", () => {
  it("stores the canonical polygon under its hash and reports the area", async () => {
    const store = new MemoryStore();
    const feature = { type: "Feature", properties: {}, geometry: SQUARE };
    const up = await uploadPolygon(store, feature);
    expect(up.polygonHash).toBe(polygonHashHex(SQUARE));
    expect(up.areaHaX100).toBe(7611);
    expect(up.key).toBe(polygonKey(up.polygonHash));
    expect(store.objects.get(up.key)?.contentType).toBe("application/geo+json");
  });

  it("rejects malformed GeoJSON and invalid polygons with 422", async () => {
    const store = new MemoryStore();
    await expect(uploadPolygon(store, { type: "Point", coordinates: [69, 52] })).rejects.toMatchObject({ status: 422 });
    await expect(uploadPolygon(store, BOWTIE)).rejects.toMatchObject({ status: 422 });
    expect(store.objects.size).toBe(0);
  });
});
