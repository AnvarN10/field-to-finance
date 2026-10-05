import type { CreatePoolInput } from "../chain/admin-ops";
import type { PoolDetail, ProjectWithFields } from "../chain/views";

/** A document already stored in the bucket under its SHA-256 (`documents/<sha256>`). */
export interface StoredDocInput {
  sha256: string;
  size: number;
  contentType: string;
}

/** The on-chain operations the arranger workflow triggers. Server keys sign them; the role guard decides who may ask. */
export interface ArrangerChain {
  /** Platform KYC approval (compliance key). Null when the wallet was already approved: nothing was sent. */
  approveKyc(wallet: string): Promise<string | null>;
  /** revoke_investor (compliance key) in every pool where the wallet holds an Instrument account, or one pool if none. */
  revokeKyc(wallet: string): Promise<string[]>;
  project(address: string): Promise<ProjectWithFields | null>;
  /** SCAS-stub FieldVerified attestations for the project's unverified fields. */
  verifyFields(project: ProjectWithFields): Promise<string[]>;
  createTermPool(input: CreatePoolInput): Promise<{ poolId: string; poolAddress: string; signature: string }>;
  addProject(poolId: string, project: string): Promise<string>;
  openPool(poolId: string): Promise<string>;
  pool(poolId: string): Promise<PoolDetail | null>;
  nextPoolId(): Promise<string>;
}
