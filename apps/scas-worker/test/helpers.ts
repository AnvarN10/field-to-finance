import { normalizePolygon, type PolygonGeometry } from "@f2f/sdk";

/** 0.01° x 0.01° near Astana: 76.11 ha geodesic area. */
export const SQUARE: PolygonGeometry = normalizePolygon({
  type: "Polygon",
  coordinates: [[[69, 52], [69.01, 52], [69.01, 52.01], [69, 52.01], [69, 52]]],
});

/** Self-intersecting ring. */
export const BOWTIE: PolygonGeometry = normalizePolygon({
  type: "Polygon",
  coordinates: [[[69, 52], [69.01, 52.01], [69.01, 52], [69, 52.01], [69, 52]]],
});

export const SQUARE_AREA_HA_X100 = 7611;
