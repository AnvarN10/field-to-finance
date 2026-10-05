import type { CreatePoolInput } from "../chain/admin-ops";
import type { PoolDetail, ProjectWithFields } from "../chain/views";

/** A document already stored in the bucket under its SHA-256 (`documents/<sha256>`). */
export interface StoredDocInput {
  sha256: string;
  size: number;
  contentType: string;
}

/** Season attestation kinds the SCAS partner records (the pre-harvest yield estimate is a Harvest attestation). */
export const SEASON_KINDS = ["Sowing", "Vegetation", "Harvest"] as const;
export type SeasonKind = (typeof SEASON_KINDS)[number];

export interface SeasonAttestInput {
  poolId: string;
  kind: SeasonKind;
  note: string | null;
  /** SHA-256 of an evidence file already stored under `documents/`. */
  documentSha256: string | null;
  /** Pre-harvest yield estimate in tonnes per hectare (Harvest only). */
  yieldEstimateTPerHa: number | null;
}

/** The on-chain operations the arranger workflow triggers. Server keys sign them; the role guard decides who may ask. */
export interface ArrangerChain {
  /** Platform KYC approval (compliance key). Null when the wallet was already approved: nothing was sent. */
  approveKyc(wallet: string): Promise<string | null>;
  /** revoke_investor (compliance key) in every pool where the wallet holds an Instrument account, or one pool if none. */
  revokeKyc(wallet: string): Promise<string[]>;
  project(address: string): Promise<ProjectWithFields | null>;
  /** One SCAS attestation of `kind` for every field of the pool's projects, evidence stored first. */
  attest(input: SeasonAttestInput): Promise<string[]>;
  /** SCAS-stub FieldVerified attestations for the project's unverified fields. */
  verifyFields(project: ProjectWithFields): Promise<string[]>;
  createTermPool(input: CreatePoolInput): Promise<{ poolId: string; poolAddress: string; signature: string }>;
  addProject(poolId: string, project: string): Promise<string>;
  openPool(poolId: string): Promise<string>;
  pool(poolId: string): Promise<PoolDetail | null>;
  nextPoolId(): Promise<string>;
}
