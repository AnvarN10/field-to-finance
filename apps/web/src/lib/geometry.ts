import { area } from "@turf/area";
import { kinks } from "@turf/kinks";
import type { PolygonGeometry } from "@f2f/sdk";
import type { Feature, Polygon } from "geojson";

/** Field.area_ha_x100 is a u32; this cap is a sanity limit for a demo field, not a program limit. */
export const MAX_FIELD_AREA_HA = 100_000;

export interface GeometryCheck {
  valid: boolean;
  areaHa: number;
  problems: string[];
}

export function checkPolygon(p: PolygonGeometry): GeometryCheck {
  const inRange = p.coordinates.every((ring) => ring.every(([lon, lat]) => lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90));
  if (!inRange) return { valid: false, areaHa: 0, problems: ["coordinates must be [longitude, latitude] in WGS84 degrees"] };
  const feature: Feature<Polygon> = { type: "Feature", properties: {}, geometry: p };
  if (kinks(feature).features.length > 0) return { valid: false, areaHa: 0, problems: ["the boundary crosses itself"] };
  const areaHa = area(feature) / 10_000;
  const problems: string[] = [];
  if (areaHa < 0.01) problems.push("the area is below 0.01 ha");
  if (areaHa > MAX_FIELD_AREA_HA) problems.push(`the area is above ${MAX_FIELD_AREA_HA} ha`);
  return { valid: problems.length === 0, areaHa, problems };
}
