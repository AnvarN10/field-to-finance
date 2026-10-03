import { polygonHashHex, toHex, type AttestationKindName, type VerdictName } from "@f2f/sdk";
import type { PublicKey } from "@solana/web3.js";
import type { Chain } from "./chain";
import { RequestError } from "./errors";
import {
  EVIDENCE_SCHEMA,
  encodeEvidence,
  evidenceKey,
  evidenceUri,
  ndviToX10k,
  polygonKey,
  sceneDateToUnix,
  type EvidenceDoc,
} from "./evidence";
import { checkPolygon } from "./geometry";
import { parsePolygon, storePolygon } from "./polygons";
import { RULES_VERSION, WINDOW_DAYS, assertRuleApplicable, decide } from "./rules/verdict";
import type { StatsSource } from "./sentinel/client";
import { parseStats, type ParsedStats } from "./sentinel/parse";
import { buildStatsRequest, windowEndingAt, type StatsRequest } from "./sentinel/request";
import type { BlobStore } from "./store";

export interface AttestRequest {
  project: PublicKey;
  fieldIndex: number;
  kind: AttestationKindName;
  /** YYYY-MM-DD in a past season; only for Sowing, Vegetation, Harvest. */
  replayDate?: string;
  /** GeoJSON; when absent the polygon is read from the bucket by the Field's on-chain hash. */
  polygon?: unknown;
  dryRun?: boolean;
}

export interface AttestResult {
  kind: AttestationKindName;
  verdict: VerdictName;
  reasons: string[];
  replay: boolean;
  asOf: string;
  ndviMean: number | null;
  ndviMeanX10k: number;
  sceneDate: string | null;
  sceneDateUnix: number;
  evidenceHash: string;
  evidenceUri: string;
  field: string;
  dryRun: boolean;
  signature: string | null;
  attestation: string | null;
  sequence: number | null;
}

export interface AttestDeps {
  chain: Chain;
  sentinel: StatsSource;
  store: BlobStore;
  evidenceBaseUrl: string;
  programId: PublicKey;
  cluster: string;
  now?: () => Date;
}

export function resolveAsOf(kind: AttestationKindName, replayDate: string | undefined, now: Date): { asOf: Date; replay: boolean } {
  if (replayDate === undefined) return { asOf: now, replay: false };
  if (kind === "FieldVerified") throw new RequestError("FieldVerified uses current imagery; a replay date is not allowed");
  const ms = Date.parse(`${replayDate}T00:00:00Z`);
  // Date.parse rolls 2026-02-30 over to March, so round-trip to reject impossible days.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(replayDate) || Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== replayDate) {
    throw new RequestError(`replay date must be YYYY-MM-DD, got "${replayDate}"`);
  }
  const asOf = new Date(`${replayDate}T12:00:00Z`);
  if (asOf.getTime() > now.getTime()) throw new RequestError("replay date is in the future");
  return { asOf, replay: true };
}

async function loadPolygon(store: BlobStore, req: AttestRequest, onChainHash: string): Promise<unknown> {
  if (req.polygon !== undefined) return req.polygon;
  const bytes = await store.get(polygonKey(onChainHash));
  if (!bytes) {
    throw new RequestError(`no stored polygon for hash ${onChainHash}; upload it with POST /polygons or pass --polygon`, 404);
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export async function runAttestation(deps: AttestDeps, req: AttestRequest): Promise<AttestResult> {
  const now = (deps.now ?? (() => new Date()))();
  const { asOf, replay } = resolveAsOf(req.kind, req.replayDate, now);

  const project = await deps.chain.loadProject(req.project);
  assertRuleApplicable(req.kind, project.crop, asOf);
  const field = await deps.chain.loadField(req.project, req.fieldIndex);

  const onChainHash = toHex(field.polygonHash);
  const polygon = parsePolygon(await loadPolygon(deps.store, req, onChainHash));
  const hashHex = polygonHashHex(polygon);
  if (hashHex !== onChainHash) {
    throw new RequestError(`polygon hash ${hashHex} does not match the Field's on-chain hash ${onChainHash}`, 409);
  }

  const geometry = checkPolygon(polygon);
  const window = windowEndingAt(asOf, WINDOW_DAYS[req.kind]);
  let request: StatsRequest | null = null;
  let response: unknown = null;
  let parsed: ParsedStats = { observations: [], failedIntervals: [], polygonPixels: 0 };
  if (geometry.valid) {
    request = buildStatsRequest(polygon, window);
    response = await deps.sentinel.fetchStats(request); // throws on failure: nothing below runs
    parsed = parseStats(response); // throws on an unusable response
  }

  const decision = decide({
    kind: req.kind,
    crop: project.crop,
    asOf,
    geometry,
    declaredAreaHa: field.areaHaX100 / 100,
    observations: parsed.observations,
  });
  const ndviMeanX10k = ndviToX10k(decision.ndviMean);
  const sceneDateUnix = sceneDateToUnix(decision.sceneDate);
  const asOfDay = asOf.toISOString().slice(0, 10);

  const doc: EvidenceDoc = {
    schema: EVIDENCE_SCHEMA,
    rulesVersion: RULES_VERSION,
    replay,
    generatedAt: now.toISOString(),
    network: { cluster: deps.cluster, programId: deps.programId.toBase58() },
    subject: {
      project: req.project.toBase58(),
      field: field.address.toBase58(),
      fieldIndex: req.fieldIndex,
      crop: project.crop,
      season: project.season,
      declaredAreaHa: field.areaHaX100 / 100,
      polygonHash: onChainHash,
    },
    kind: req.kind,
    asOf: asOfDay,
    window,
    polygon,
    geometry,
    request,
    response,
    scenes: parsed.observations,
    failedIntervals: parsed.failedIntervals,
    decision,
    onChain: { ndviMeanX10k, sceneDate: sceneDateUnix },
    signer: deps.chain.scas.toBase58(),
  };
  const encoded = encodeEvidence(doc);
  const uri = evidenceUri(deps.evidenceBaseUrl, encoded.hashHex);

  const result: AttestResult = {
    kind: req.kind,
    verdict: decision.verdict,
    reasons: decision.reasons,
    replay,
    asOf: asOfDay,
    ndviMean: decision.ndviMean,
    ndviMeanX10k,
    sceneDate: decision.sceneDate,
    sceneDateUnix,
    evidenceHash: encoded.hashHex,
    evidenceUri: uri,
    field: field.address.toBase58(),
    dryRun: req.dryRun === true,
    signature: null,
    attestation: null,
    sequence: null,
  };
  if (req.dryRun) return result;

  if (req.polygon !== undefined) await storePolygon(deps.store, polygon);
  await deps.store.put(evidenceKey(encoded.hashHex), encoded.bytes, "application/json");
  const sent = await deps.chain.sendAttestation({
    project: req.project,
    field: field.address,
    kind: req.kind,
    verdict: decision.verdict,
    evidenceHash: encoded.hash,
    evidenceUri: uri,
    ndviMeanX10k,
    sceneDate: sceneDateUnix,
  });
  return { ...result, signature: sent.signature, attestation: sent.attestation.toBase58(), sequence: sent.sequence };
}
