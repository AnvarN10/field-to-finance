import { canonicalJson, sha256, toHex } from "./canonical";

export type Position = [number, number];

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

export class PolygonFormatError extends Error {
  override name = "PolygonFormatError";
}

/** About 1 cm at the equator; enough for field boundaries and stable across tools. */
export const COORDINATE_DECIMALS = 7;
const SCALE = 10 ** COORDINATE_DECIMALS;

function round(n: number): number {
  const r = Math.round(n * SCALE) / SCALE;
  return Object.is(r, -0) ? 0 : r;
}

function extractGeometry(input: unknown): unknown {
  if (!input || typeof input !== "object") throw new PolygonFormatError("GeoJSON must be an object");
  const obj = input as { type?: unknown; geometry?: unknown; features?: unknown };
  if (obj.type === "Feature") return obj.geometry;
  if (obj.type === "FeatureCollection") {
    if (!Array.isArray(obj.features) || obj.features.length !== 1) {
      throw new PolygonFormatError("FeatureCollection must contain exactly one feature");
    }
    return (obj.features[0] as { geometry?: unknown } | undefined)?.geometry;
  }
  return input;
}

/**
 * Reduces any accepted GeoJSON input to the canonical Polygon that is hashed:
 * Feature and one-feature FeatureCollection are unwrapped, altitude is dropped,
 * coordinates are rounded to 7 decimals, and open rings are closed.
 */
export function normalizePolygon(input: unknown): PolygonGeometry {
  const geometry = extractGeometry(input) as { type?: unknown; coordinates?: unknown } | null | undefined;
  if (!geometry || geometry.type !== "Polygon") throw new PolygonFormatError("geometry must be a GeoJSON Polygon");
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    throw new PolygonFormatError("Polygon must have at least one ring");
  }
  const rings = geometry.coordinates.map((ring: unknown, r: number) => {
    if (!Array.isArray(ring)) throw new PolygonFormatError(`ring ${r} is not an array`);
    const positions: Position[] = ring.map((p: unknown, i: number) => {
      if (
        !Array.isArray(p) ||
        p.length < 2 ||
        typeof p[0] !== "number" ||
        typeof p[1] !== "number" ||
        !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1])
      ) {
        throw new PolygonFormatError(`ring ${r} position ${i} is not [lon, lat]`);
      }
      return [round(p[0]), round(p[1])];
    });
    const first = positions[0];
    const last = positions[positions.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) positions.push([first[0], first[1]]);
    if (positions.length < 4) throw new PolygonFormatError(`ring ${r} needs at least 4 positions`);
    return positions;
  });
  return { type: "Polygon", coordinates: rings };
}

/** The value stored in Field.polygon_hash: sha256 of the canonical JSON of the normalized polygon. */
export function polygonHash(input: unknown): Uint8Array {
  return sha256(canonicalJson(normalizePolygon(input)));
}

export function polygonHashHex(input: unknown): string {
  return toHex(polygonHash(input));
}
