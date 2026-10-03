/**
 * The same two demo boundaries as public/samples/demo-fields.geojson (a test keeps them equal), so the
 * demo registers fields whose on-chain area matches the polygon the field page draws. Not pilot data.
 */
export const DEMO_FIELDS: { name: string; geojson: object }[] = [
  {
    name: "Demo field A",
    geojson: {
      type: "Feature",
      properties: { name: "Demo field A" },
      geometry: { type: "Polygon", coordinates: [[[63.6, 53.2], [63.612, 53.2], [63.612, 53.2063], [63.6, 53.2063], [63.6, 53.2]]] },
    },
  },
  {
    name: "Demo field B",
    geojson: {
      type: "Feature",
      properties: { name: "Demo field B" },
      geometry: { type: "Polygon", coordinates: [[[63.62, 53.2], [63.63, 53.2], [63.63, 53.207], [63.62, 53.207], [63.62, 53.2]]] },
    },
  },
];
