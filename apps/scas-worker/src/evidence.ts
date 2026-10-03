import {
  MAX_EVIDENCE_URI_LEN,
  NDVI_SCALE,
  canonicalJson,
  sha256,
  toHex,
  type AttestationKindName,
  type PolygonGeometry,
  type VerdictName,
} from "@f2f/sdk";
import type { GeometryCheck } from "./geometry";
import type { FailedInterval, Observation } from "./sentinel/parse";
import type { StatsRequest, TimeWindow } from "./sentinel/request";

export const EVIDENCE_SCHEMA = "f2f-scas-evidence/1";

/** The document behind an Attestation. Its sha256 is the on-chain evidence_hash. */
export interface EvidenceDoc {
  schema: typeof EVIDENCE_SCHEMA;
  rulesVersion: string;
  /** True when the as-of date is a replay of a past season (spec 4.4, season timing). */
  replay: boolean;
  generatedAt: string;
  network: { cluster: string; programId: string };
  subject: {
    project: string;
    field: string;
    fieldIndex: number;
    crop: string;
    season: number;
    declaredAreaHa: number;
    polygonHash: string;
  };
  kind: AttestationKindName;
  asOf: string;
  window: TimeWindow;
  polygon: PolygonGeometry;
  geometry: GeometryCheck;
  /** The exact Statistical API request body; null when the polygon was invalid and no call was made. */
  request: StatsRequest | null;
  /** The raw Statistical API response. */
  response: unknown;
  scenes: Observation[];
  failedIntervals: FailedInterval[];
  decision: { verdict: VerdictName; ndviMean: number | null; sceneDate: string | null; reasons: string[] };
  onChain: { ndviMeanX10k: number; sceneDate: number };
  signer: string;
}

export interface EncodedEvidence {
  bytes: Uint8Array;
  hash: Uint8Array;
  hashHex: string;
}

export function encodeEvidence(doc: EvidenceDoc): EncodedEvidence {
  const bytes = new TextEncoder().encode(canonicalJson(doc));
  const hash = sha256(bytes);
  return { bytes, hash, hashHex: toHex(hash) };
}

export const evidenceKey = (hashHex: string) => `evidence/${hashHex}.json`;
export const polygonKey = (hashHex: string) => `polygons/${hashHex}.json`;

export function evidenceUri(baseUrl: string, hashHex: string): string {
  const uri = `${baseUrl.replace(/\/+$/, "")}/e/${hashHex}`;
  if (uri.length > MAX_EVIDENCE_URI_LEN) {
    throw new Error(`evidence URI is ${uri.length} bytes; the program allows ${MAX_EVIDENCE_URI_LEN}. Shorten EVIDENCE_BASE_URL.`);
  }
  return uri;
}

export function ndviToX10k(mean: number | null): number {
  if (mean === null) return 0;
  return Math.max(-NDVI_SCALE, Math.min(NDVI_SCALE, Math.round(mean * NDVI_SCALE)));
}

/** Unix seconds of the acquisition day at 00:00 UTC; 0 when there is no scene. */
export function sceneDateToUnix(date: string | null): number {
  if (date === null) return 0;
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
}
