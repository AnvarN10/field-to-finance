import type { PolygonGeometry } from "@f2f/sdk";
import { EVALSCRIPT } from "./evalscript";

export const CRS_WGS84 = "http://www.opengis.net/def/crs/EPSG/0/4326";
/** Tile-level prefilter only, to save processing units. The 30% rule is applied per polygon. */
export const MAX_TILE_CLOUD_COVER = 80;
const METERS_PER_DEGREE = 111_320;
const DAY_MS = 86_400_000;

export interface TimeWindow {
  from: string;
  to: string;
}

export interface StatsRequest {
  input: {
    bounds: { geometry: PolygonGeometry; properties: { crs: string } };
    data: { type: "sentinel-2-l2a"; dataFilter: { maxCloudCoverage: number; mosaickingOrder: "leastCC" } }[];
  };
  aggregation: {
    timeRange: TimeWindow;
    aggregationInterval: { of: "P1D" };
    evalscript: string;
    resx: number;
    resy: number;
  };
}

const round8 = (n: number) => Math.round(n * 1e8) / 1e8;
const isoSeconds = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");

/** In EPSG:4326 resx/resy are degrees; this gives about 10 m pixels at the given latitude. */
export function resolutionDegrees(latitude: number): { resx: number; resy: number } {
  return {
    resx: round8(10 / (METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180))),
    resy: round8(10 / METERS_PER_DEGREE),
  };
}

function centroidLatitude(polygon: PolygonGeometry): number {
  const outer = polygon.coordinates[0] ?? [];
  const points = outer.slice(0, -1);
  return points.reduce((sum, p) => sum + p[1], 0) / Math.max(points.length, 1);
}

/** `days` whole UTC days ending with the as-of day; `to` is exclusive, so P1D divides it exactly. */
export function windowEndingAt(asOf: Date, days: number): TimeWindow {
  const end = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() + 1);
  return { from: isoSeconds(end - days * DAY_MS), to: isoSeconds(end) };
}

export function buildStatsRequest(polygon: PolygonGeometry, window: TimeWindow): StatsRequest {
  const { resx, resy } = resolutionDegrees(centroidLatitude(polygon));
  return {
    input: {
      bounds: { geometry: polygon, properties: { crs: CRS_WGS84 } },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: { maxCloudCoverage: MAX_TILE_CLOUD_COVER, mosaickingOrder: "leastCC" },
        },
      ],
    },
    aggregation: {
      timeRange: window,
      aggregationInterval: { of: "P1D" },
      evalscript: EVALSCRIPT,
      resx,
      resy,
    },
  };
}
