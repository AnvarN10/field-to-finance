/** Client-safe: used in the browser before upload. One Polygon per Field. */
export const MAX_FIELDS_PER_UPLOAD = 4;

export class GeoJsonInputError extends Error {
  override name = "GeoJsonInputError";
}

function geometryType(item: unknown): unknown {
  const o = item as { type?: unknown; geometry?: { type?: unknown } } | null;
  return o?.type === "Feature" ? o.geometry?.type : o?.type;
}

export function splitFeatures(input: unknown): unknown[] {
  if (!input || typeof input !== "object") throw new GeoJsonInputError("The file is not GeoJSON.");
  const o = input as { type?: unknown; features?: unknown };
  const items = o.type === "FeatureCollection" ? (Array.isArray(o.features) ? o.features : []) : [input];
  if (items.length === 0) throw new GeoJsonInputError("The file has no fields.");
  if (items.length > MAX_FIELDS_PER_UPLOAD) {
    throw new GeoJsonInputError(`Upload at most ${MAX_FIELDS_PER_UPLOAD} fields per project.`);
  }
  items.forEach((item, i) => {
    const t = geometryType(item);
    if (t === "MultiPolygon") {
      throw new GeoJsonInputError(`Field ${i + 1} is a MultiPolygon. Split it into one Polygon per field.`);
    }
    if (t !== "Polygon") throw new GeoJsonInputError(`Field ${i + 1} is not a Polygon.`);
  });
  return items;
}
