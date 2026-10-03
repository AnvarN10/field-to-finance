import type { StyleSpecification } from "maplibre-gl";
import maplibrePkg from "maplibre-gl/package.json";

/**
 * maplibre-gl 6 starts its module worker from `new URL("./maplibre-gl-worker.mjs", import.meta.url)`,
 * which the Next bundler does not emit. The worker and its shared chunk are copied to
 * public/maplibre/<version>/ (a test keeps them byte-equal to the installed package).
 */
export const MAPLIBRE_WORKER_URL = `/maplibre/${maplibrePkg.version}/maplibre-gl-worker.mjs`;

/** Keyless satellite tiles; attribution is required by Esri's terms. */
export const ESRI_IMAGERY_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const ESRI_ATTRIBUTION = "Imagery © Esri, Maxar, Earthstar Geographics";

export function polygonBounds(polygons: { coordinates: number[][][] }[]): [[number, number], [number, number]] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygons) {
    for (const ring of p.coordinates) {
      for (const [x, y] of ring) {
        if (x === undefined || y === undefined) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}

export function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    sources: { imagery: { type: "raster", tiles: [ESRI_IMAGERY_TILES], tileSize: 256, maxzoom: 19, attribution: ESRI_ATTRIBUTION } },
    layers: [{ id: "imagery", type: "raster", source: "imagery" }],
  };
}
