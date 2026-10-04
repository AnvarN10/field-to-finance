/**
 * Client-safe field import (ADR 0014): GeoJSON or KML exports of farm boundaries, MultiPolygons split
 * into one field per part, cadastral numbers read from feature properties when present.
 * Cadastral numbers stay in the bucket and the admin's input; they never go on-chain or into the repo.
 */
export const MAX_FIELDS_PER_IMPORT = 64;
export const AREA_TOLERANCE = 0.05;

export class FieldImportError extends Error {
  override name = "FieldImportError";
}

type Position = number[];
type PolygonGeom = { type: "Polygon"; coordinates: Position[][] };
type MultiPolygonGeom = { type: "MultiPolygon"; coordinates: Position[][][] };
export type AreaFeature = { type: "Feature"; properties: Record<string, unknown>; geometry: PolygonGeom | MultiPolygonGeom };
export type PolygonFeature = { type: "Feature"; properties: Record<string, unknown>; geometry: PolygonGeom };

export interface ImportedField {
  name: string;
  cadastralNumber: string | null;
  feature: PolygonFeature;
}

const KML_NS = "http://www.opengis.net/kml/2.2";

function children(el: Element, name: string): Element[] {
  return Array.from(el.getElementsByTagName(name)).concat(Array.from(el.getElementsByTagNameNS(KML_NS, name))).filter((v, i, a) => a.indexOf(v) === i);
}

function direct(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === name);
}

function parseCoordinates(text: string): Position[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const [lon, lat] = t.split(",").map(Number);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new FieldImportError("A KML coordinate is not a number.");
      return [lon as number, lat as number];
    });
}

function ringOf(boundary: Element | undefined): Position[] | null {
  const coords = boundary ? children(boundary, "coordinates")[0] : undefined;
  return coords?.textContent ? parseCoordinates(coords.textContent) : null;
}

function polygonOf(el: Element): Position[][] {
  const outer = ringOf(direct(el, "outerBoundaryIs")[0]);
  if (!outer) throw new FieldImportError("A KML polygon has no outer boundary.");
  const inner = direct(el, "innerBoundaryIs").map((b) => ringOf(b)).filter((r): r is Position[] => r !== null);
  return [outer, ...inner];
}

function extendedData(placemark: Element): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const d of children(placemark, "Data")) {
    const key = d.getAttribute("name");
    const value = children(d, "value")[0]?.textContent;
    if (key && value != null) props[key] = value.trim();
  }
  for (const d of children(placemark, "SimpleData")) {
    const key = d.getAttribute("name");
    if (key && d.textContent != null) props[key] = d.textContent.trim();
  }
  return props;
}

/** Converts KML Placemarks with Polygon or MultiGeometry areas to GeoJSON; lines and points are skipped. */
export function kmlToGeoJson(text: string, parser: DOMParser): { type: "FeatureCollection"; features: AreaFeature[] } {
  const doc = parser.parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0 || doc.documentElement.localName !== "kml") {
    throw new FieldImportError("The file is not KML. Export the boundaries as KML or GeoJSON.");
  }
  const features: AreaFeature[] = [];
  for (const pm of children(doc.documentElement, "Placemark")) {
    const polygons = children(pm, "Polygon").map(polygonOf);
    if (polygons.length === 0) continue;
    const name = direct(pm, "name")[0]?.textContent?.trim();
    const properties = { ...(name ? { name } : {}), ...extendedData(pm) };
    const geometry: PolygonGeom | MultiPolygonGeom =
      polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] as Position[][] } : { type: "MultiPolygon", coordinates: polygons };
    features.push({ type: "Feature", properties, geometry });
  }
  return { type: "FeatureCollection", features };
}

const CADASTRAL_KEYS = ["cadastral", "cadastral_number", "cadastralnumber", "cadastre", "kad_nomer", "kadnomer", "kadastr", "кадастровыйномер", "кадастр", "kn"];

/** A cadastral number from common property names (case, spaces and underscores ignored). */
export function cadastralOf(props: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(props)) {
    const norm = k.toLowerCase().replace(/[\s_-]/g, "");
    if (CADASTRAL_KEYS.some((c) => c.replace(/_/g, "") === norm) && (typeof v === "string" || typeof v === "number") && String(v).trim()) {
      return String(v).trim();
    }
  }
  return null;
}

function asFeatures(input: unknown): { properties: Record<string, unknown>; geometry: unknown }[] {
  if (!input || typeof input !== "object") throw new FieldImportError("The file is not GeoJSON.");
  const o = input as { type?: unknown; features?: unknown; geometry?: unknown; properties?: unknown };
  if (o.type === "FeatureCollection") {
    return (Array.isArray(o.features) ? o.features : []).map((f) => ({
      properties: ((f as { properties?: unknown }).properties as Record<string, unknown>) ?? {},
      geometry: (f as { geometry?: unknown }).geometry,
    }));
  }
  if (o.type === "Feature") return [{ properties: (o.properties as Record<string, unknown>) ?? {}, geometry: o.geometry }];
  return [{ properties: {}, geometry: input }];
}

/** One field per Polygon; a MultiPolygon becomes one field per part, each keeping the feature's properties. */
export function explodeFields(input: unknown): ImportedField[] {
  const out: ImportedField[] = [];
  asFeatures(input).forEach((f, i) => {
    const g = f.geometry as { type?: unknown; coordinates?: unknown } | null;
    const base = typeof f.properties.name === "string" && f.properties.name.trim() ? f.properties.name.trim() : `Field ${i + 1}`;
    const cadastralNumber = cadastralOf(f.properties);
    if (g?.type === "Polygon") {
      out.push({ name: base, cadastralNumber, feature: { type: "Feature", properties: f.properties, geometry: g as PolygonGeom } });
    } else if (g?.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
      (g.coordinates as Position[][][]).forEach((coordinates, p) =>
        out.push({ name: `${base} · part ${p + 1}`, cadastralNumber, feature: { type: "Feature", properties: f.properties, geometry: { type: "Polygon", coordinates } } }),
      );
    }
  });
  if (out.length === 0) throw new FieldImportError("The file has no field boundaries (Polygon or MultiPolygon).");
  if (out.length > MAX_FIELDS_PER_IMPORT) throw new FieldImportError(`Import at most ${MAX_FIELDS_PER_IMPORT} fields at a time.`);
  return out;
}

/** GeoJSON or KML, chosen by extension or by content. */
export function parseFieldFile(fileName: string, text: string, parser: DOMParser): ImportedField[] {
  const isKml = /\.kml$/i.test(fileName) || text.trimStart().startsWith("<");
  if (isKml) return explodeFields(kmlToGeoJson(text, parser));
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new FieldImportError("The file is not valid GeoJSON or KML.");
  }
  return explodeFields(parsed);
}

/** Polygon area against the declared area (land-use act); more than 5% apart is flagged. */
export function areaCheck(polygonHa: number, declaredHa: number | null): { ok: boolean; deltaPct: number | null } {
  if (declaredHa == null || !(declaredHa > 0)) return { ok: true, deltaPct: null };
  const delta = (polygonHa - declaredHa) / declaredHa;
  return { ok: Math.abs(delta) <= AREA_TOLERANCE, deltaPct: Math.round(delta * 1000) / 10 };
}
