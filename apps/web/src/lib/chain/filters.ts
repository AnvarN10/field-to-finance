import type { GetProgramAccountsFilter, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

/** Byte offsets after the 8-byte Anchor discriminator; pinned by test/filters.test.ts against real encodings. */
export const OFFSETS = {
  projectProducer: 8,
  /** FarmProject.pool is Option<Pubkey>: tag byte at 48 (producer 32 + project_id 8), key at 49. */
  projectPoolTag: 48,
  fieldProject: 8,
  attestationField: 8,
  /** Attestation.project follows field (32 bytes). */
  attestationProject: 40,
} as const;

const at = (offset: number, bytes: Uint8Array): GetProgramAccountsFilter => ({ memcmp: { offset, bytes: bs58.encode(bytes) } });

export const projectsByProducer = (producer: PublicKey) => at(OFFSETS.projectProducer, producer.toBytes());
export const projectsInPool = (pool: PublicKey) => at(OFFSETS.projectPoolTag, Uint8Array.from([1, ...pool.toBytes()]));
export const projectsWithoutPool = () => at(OFFSETS.projectPoolTag, Uint8Array.from([0]));
export const fieldsOfProject = (project: PublicKey) => at(OFFSETS.fieldProject, project.toBytes());
export const attestationsOfField = (field: PublicKey) => at(OFFSETS.attestationField, field.toBytes());
export const attestationsOfProject = (project: PublicKey) => at(OFFSETS.attestationProject, project.toBytes());
