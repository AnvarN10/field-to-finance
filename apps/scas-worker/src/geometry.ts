import type { PolygonGeometry } from "@f2f/sdk";
import { area } from "@turf/area";
import { kinks } from "@turf/kinks";

/** Guards the CDSE quota: larger areas are almost certainly a wrong file, not a field. */
export const MAX_FIELD_AREA_HA = 20_000;

export interface GeometryCheck {
  valid: boolean;
  areaHa: number;
  reasons: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function checkPolygon(polygon: PolygonGeometry): GeometryCheck {
  const reasons: string[] = [];

  polygon.coordinates.forEach((ring, r) => {
    if (ring.some(([lon, lat]) => lon < -180 || lon > 180 || lat < -90 || lat > 90)) {
      reasons.push(`ring ${r} has a coordinate outside lon/lat bounds`);
    }
  });
  if (reasons.length === 0 && kinks(polygon).features.length > 0) {
    reasons.push("polygon boundary self-intersects");
  }

  const areaHa = reasons.length === 0 ? round2(area(polygon) / 10_000) : 0;
  if (reasons.length === 0 && areaHa <= 0) reasons.push("polygon has zero area");
  if (areaHa > MAX_FIELD_AREA_HA) reasons.push(`polygon area ${areaHa} ha exceeds ${MAX_FIELD_AREA_HA} ha`);

  return { valid: reasons.length === 0, areaHa, reasons };
}

export function areaMismatch(computedHa: number, declaredHa: number): number {
  return Math.abs(computedHa - declaredHa) / declaredHa;
}
