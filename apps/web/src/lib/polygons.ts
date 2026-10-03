import { PolygonFormatError, canonicalJson, normalizePolygon, sha256, toHex, type PolygonGeometry } from "@f2f/sdk";
import { RequestError } from "./errors";
import { checkPolygon } from "./geometry";
import { polygonKey, readHashed, type BlobStore } from "./store";

export interface PolygonUpload {
  polygonHash: string;
  areaHa: number;
  areaHaX100: number;
  polygon: PolygonGeometry;
}

/** Validates, stores polygons/<hash>.json and returns the hash that register_field must use. */
export async function uploadPolygon(store: BlobStore, geojson: unknown): Promise<PolygonUpload> {
  let polygon: PolygonGeometry;
  try {
    polygon = normalizePolygon(geojson);
  } catch (e) {
    if (e instanceof PolygonFormatError) throw new RequestError(e.message, 422);
    throw e;
  }
  const check = checkPolygon(polygon);
  if (!check.valid) throw new RequestError(check.problems.join("; "), 422);
  // Same bytes polygonHash() hashes: sha256(canonicalJson(normalizePolygon(input))).
  const bytes = new TextEncoder().encode(canonicalJson(polygon));
  const polygonHash = toHex(sha256(bytes));
  await store.put(polygonKey(polygonHash), bytes, "application/json");
  return { polygonHash, areaHa: Math.round(check.areaHa * 100) / 100, areaHaX100: Math.round(check.areaHa * 100), polygon };
}

export async function loadPolygon(store: BlobStore, hashHex: string): Promise<PolygonGeometry | null> {
  const bytes = await readHashed(store, polygonKey(hashHex), hashHex);
  return bytes ? (JSON.parse(new TextDecoder().decode(bytes)) as PolygonGeometry) : null;
}
