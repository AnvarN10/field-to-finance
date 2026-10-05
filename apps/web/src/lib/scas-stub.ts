import type { Program } from "@anchor-lang/core";
import { MAX_EVIDENCE_URI_LEN, attestationPda, canonicalJson, fieldPda, sha256, toHex, type AttestationKindName, type F2f } from "@f2f/sdk";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { recordAttestationIx } from "./chain/ix";
import type { FieldAccount, ProjectWithFields } from "./chain/views";
import { RequestError } from "./errors";
import { createSerialQueue, type SerialQueue } from "./serial";
import { evidenceKey, type BlobStore } from "./store";

export const SCAS_STUB_PROVIDER = "scas-stub";
export const SCAS_STUB_NOTE = "External SCAS provider integration pending";
export const STUB_EVIDENCE_SCHEMA = "f2f-scas-stub-evidence/1";

export interface StubEvidence {
  schema: typeof STUB_EVIDENCE_SCHEMA;
  provider: typeof SCAS_STUB_PROVIDER;
  note: string;
  kind: AttestationKindName;
  verdict: "Pass";
  polygonHash: string;
  fieldAreaHaX100: number;
  recordedAt: string;
  subject: { cluster: string; programId: string; project: string; field: string; fieldIndex: number; sequence: number };
  signer: string;
  /** What the SCAS partner observed (season attestations from the SCAS cabinet). */
  observation?: string;
  /** SHA-256 of the partner's evidence file under `documents/`. */
  documentSha256?: string;
  /** Pre-harvest yield estimate, tonnes per hectare (Harvest). */
  yieldEstimateTPerHa?: number;
}

/** Optional partner input for a season attestation; absent keys stay out of the evidence JSON. */
export interface AttestExtra {
  observation?: string | null;
  documentSha256?: string | null;
  yieldEstimateTPerHa?: number | null;
}

export function encodeEvidence(doc: StubEvidence): { bytes: Uint8Array; hash: Uint8Array; hashHex: string } {
  const bytes = new TextEncoder().encode(canonicalJson(doc));
  const hash = sha256(bytes);
  return { bytes, hash, hashHex: toHex(hash) };
}

export function evidenceUri(publicBaseUrl: string, hashHex: string): string {
  const uri = `${publicBaseUrl.replace(/\/+$/, "")}/api/evidence/${hashHex}`;
  if (uri.length > MAX_EVIDENCE_URI_LEN) {
    throw new Error(`evidence URI is ${uri.length} bytes; the program allows ${MAX_EVIDENCE_URI_LEN}. Shorten PUBLIC_BASE_URL.`);
  }
  return uri;
}

export interface StubDeps {
  /** Used to build instructions; its provider never signs. */
  program: Program<F2f>;
  readField(address: PublicKey): Promise<FieldAccount | null>;
  /** Signs with the SCAS key and confirms. */
  send(ixs: TransactionInstruction[]): Promise<string>;
  store: BlobStore;
  scas: PublicKey;
  publicBaseUrl: string;
  cluster: string;
  now?: () => Date;
  queue?: SerialQueue;
}

export interface AttestStubInput {
  project: PublicKey;
  fieldIndex: number;
  kind: AttestationKindName;
  extra?: AttestExtra;
}

export interface AttestStubResult {
  kind: AttestationKindName;
  verdict: "Pass";
  project: string;
  field: string;
  fieldIndex: number;
  sequence: number;
  attestation: string;
  signature: string;
  evidenceHash: string;
  evidenceUri: string;
}

/** One queue per process: attestation PDAs are keyed by attestation_count, so sends on a field must not overlap. */
const processQueue = createSerialQueue();

export function attestStub(deps: StubDeps, input: AttestStubInput): Promise<AttestStubResult> {
  return (deps.queue ?? processQueue).run(async () => {
    const programId = deps.program.programId;
    const field = fieldPda(programId, input.project, input.fieldIndex);
    const account = await deps.readField(field);
    if (!account) {
      throw new RequestError(`Field ${input.fieldIndex} of project ${input.project.toBase58()} does not exist`, 404);
    }
    const now = (deps.now ?? (() => new Date()))();
    const sequence = account.attestationCount;
    const doc: StubEvidence = {
      schema: STUB_EVIDENCE_SCHEMA,
      provider: SCAS_STUB_PROVIDER,
      note: SCAS_STUB_NOTE,
      kind: input.kind,
      verdict: "Pass",
      polygonHash: toHex(Uint8Array.from(account.polygonHash)),
      fieldAreaHaX100: account.areaHaX100,
      recordedAt: now.toISOString(),
      subject: {
        cluster: deps.cluster,
        programId: programId.toBase58(),
        project: input.project.toBase58(),
        field: field.toBase58(),
        fieldIndex: input.fieldIndex,
        sequence,
      },
      signer: deps.scas.toBase58(),
      ...(input.extra?.observation ? { observation: input.extra.observation } : {}),
      ...(input.extra?.documentSha256 ? { documentSha256: input.extra.documentSha256 } : {}),
      ...(input.extra?.yieldEstimateTPerHa != null ? { yieldEstimateTPerHa: input.extra.yieldEstimateTPerHa } : {}),
    };
    const enc = encodeEvidence(doc);
    const uri = evidenceUri(deps.publicBaseUrl, enc.hashHex);
    // Evidence first: an Attestation must never point at a missing document.
    await deps.store.put(evidenceKey(enc.hashHex), enc.bytes, "application/json");
    const ix = await recordAttestationIx(deps.program, {
      scas: deps.scas,
      project: input.project,
      field,
      sequence,
      kind: input.kind,
      verdict: "Pass",
      evidenceHash: enc.hash,
      evidenceUri: uri,
      ndviMeanX10k: 0,
      sceneDate: Math.floor(now.getTime() / 1000),
    });
    const signature = await deps.send([ix]);
    return {
      kind: input.kind,
      verdict: "Pass",
      project: input.project.toBase58(),
      field: field.toBase58(),
      fieldIndex: input.fieldIndex,
      sequence,
      attestation: attestationPda(programId, field, sequence).toBase58(),
      signature,
      evidenceHash: enc.hashHex,
      evidenceUri: uri,
    };
  });
}

export interface BatchResult {
  results: AttestStubResult[];
  failures: { field: string; error: string }[];
}

async function runBatch(deps: StubDeps, targets: { project: string; field: string; index: number }[], kind: AttestationKindName, extra?: AttestExtra): Promise<BatchResult> {
  const out: BatchResult = { results: [], failures: [] };
  for (const t of targets) {
    try {
      out.results.push(await attestStub(deps, { project: new PublicKey(t.project), fieldIndex: t.index, kind, ...(extra ? { extra } : {}) }));
    } catch (e) {
      out.failures.push({ field: t.field, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/** Admin "Verify all fields": FieldVerified for every unverified field of every project not yet in a pool. */
export function verifyAllFields(deps: StubDeps, projects: ProjectWithFields[]): Promise<BatchResult> {
  const targets = projects
    .filter((p) => p.pool === null)
    .flatMap((p) => p.fields.filter((f) => !f.verified).map((f) => ({ project: p.address, field: f.address, index: f.index })));
  return runBatch(deps, targets, "FieldVerified");
}

/** Admin "Attest season stage": one Attestation of `kind` for every field of the given projects. */
export function attestStage(deps: StubDeps, projects: ProjectWithFields[], kind: Exclude<AttestationKindName, "FieldVerified">, extra?: AttestExtra): Promise<BatchResult> {
  const targets = projects.flatMap((p) => p.fields.map((f) => ({ project: p.address, field: f.address, index: f.index })));
  return runBatch(deps, targets, kind, extra);
}
