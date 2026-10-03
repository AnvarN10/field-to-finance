/**
 * The same two demo boundaries as public/samples/demo-fields.geojson (a test keeps them equal), so the
 * demo registers fields whose on-chain area matches the polygon the field page draws. Two strip fields on
 * farmland about 12 km east of Kostanay, traced from the satellite tiles. Sample data, not pilot data.
 */
export const DEMO_FIELDS: { name: string; geojson: object }[] = [
  {
    name: "Demo field A",
    geojson: {
      type: "Feature",
      properties: { name: "Demo field A" },
      geometry: { type: "Polygon", coordinates: [[[63.80064, 53.24316], [63.84081, 53.23648], [63.83695, 53.228], [63.79017, 53.23545], [63.79292, 53.23792], [63.80064, 53.24316]]] },
    },
  },
  {
    name: "Demo field B",
    geojson: {
      type: "Feature",
      properties: { name: "Demo field B" },
      geometry: { type: "Polygon", coordinates: [[[63.78759, 53.23083], [63.83068, 53.22456], [63.82939, 53.22045], [63.78648, 53.2261], [63.78759, 53.23083]]] },
    },
  },
];
