import { canonicalJson, normalizePolygon, polygonHashHex, type PolygonGeometry } from "@f2f/sdk";
import { RequestError } from "./errors";
import { polygonKey } from "./evidence";
import { checkPolygon } from "./geometry";
import type { BlobStore } from "./store";

export interface PolygonUpload {
  polygonHash: string;
  areaHa: number;
  areaHaX100: number;
  key: string;
}

export function parsePolygon(geojson: unknown): PolygonGeometry {
  try {
    return normalizePolygon(geojson);
  } catch (err) {
    throw new RequestError(`polygon is not valid GeoJSON: ${(err as Error).message}`, 422);
  }
}

export async function storePolygon(store: BlobStore, polygon: PolygonGeometry): Promise<string> {
  const key = polygonKey(polygonHashHex(polygon));
  await store.put(key, new TextEncoder().encode(canonicalJson(polygon)), "application/geo+json");
  return key;
}

/** Called by the web app before register_field so SCAS can later find the polygon by its on-chain hash. */
export async function uploadPolygon(store: BlobStore, geojson: unknown): Promise<PolygonUpload> {
  const polygon = parsePolygon(geojson);
  const check = checkPolygon(polygon);
  if (!check.valid) throw new RequestError(`polygon rejected: ${check.reasons.join("; ")}`, 422);
  const key = await storePolygon(store, polygon);
  return {
    polygonHash: polygonHashHex(polygon),
    areaHa: check.areaHa,
    areaHaX100: Math.round(check.areaHa * 100),
    key,
  };
}
