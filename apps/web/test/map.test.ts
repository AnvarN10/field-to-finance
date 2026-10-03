import { describe, expect, it } from "vitest";
import { ESRI_IMAGERY_TILES, polygonBounds, satelliteStyle } from "../src/lib/map";

describe("map helpers", () => {
  it("computes bounds over several polygons", () => {
    const a = { coordinates: [[[63.6, 53.2], [63.612, 53.2], [63.612, 53.2063], [63.6, 53.2]]] };
    const b = { coordinates: [[[63.62, 53.19], [63.63, 53.2], [63.63, 53.207], [63.62, 53.19]]] };
    expect(polygonBounds([a, b])).toEqual([[63.6, 53.19], [63.63, 53.207]]);
    expect(polygonBounds([])).toBeNull();
  });

  it("uses keyless Esri World Imagery tiles with attribution", () => {
    const style = satelliteStyle();
    const src = style.sources.imagery as { tiles: string[]; attribution: string };
    expect(src.tiles[0]).toBe(ESRI_IMAGERY_TILES);
    expect(ESRI_IMAGERY_TILES).toBe("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
    expect(src.attribution).toMatch(/Esri/);
  });
});

describe("maplibre worker", () => {
  it("serves the worker and its shared chunk from public/, byte-equal to the installed maplibre-gl", async () => {
    const { readFileSync } = await import("node:fs");
    const { createRequire } = await import("node:module");
    const { dirname, join } = await import("node:path");
    const { MAPLIBRE_WORKER_URL } = await import("../src/lib/map");
    const require = createRequire(import.meta.url);
    const pkgDir = dirname(require.resolve("maplibre-gl/package.json"));
    const version = (JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as { version: string }).version;
    expect(MAPLIBRE_WORKER_URL).toBe(`/maplibre/${version}/maplibre-gl-worker.mjs`);
    for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
      const served = readFileSync(join(__dirname, "..", "public", "maplibre", version, f));
      expect(served.equals(readFileSync(join(pkgDir, "dist", f)))).toBe(true);
    }
  });
});
