import { PublicKey } from "@solana/web3.js";

/** Seeds from anchor/programs/f2f/src/constants.rs. */
export const SEED = {
  config: "config",
  pool: "pool",
  mint: "mint",
  project: "project",
  field: "field",
  attestation: "attestation",
  investor: "investor",
  fees: "fees",
  terms: "terms",
  instrument: "instrument",
} as const;

const utf8 = (s: string) => Buffer.from(s, "utf8");

function u8(n: number): Buffer {
  if (!Number.isInteger(n) || n < 0 || n > 0xff) throw new RangeError(`u8 out of range: ${n}`);
  return Buffer.from([n]);
}

function u32le(n: number): Buffer {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new RangeError(`u32 out of range: ${n}`);
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

function u64le(n: bigint | number): Buffer {
  const v = BigInt(n);
  if (v < 0n || v > 0xffffffffffffffffn) throw new RangeError(`u64 out of range: ${n}`);
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v);
  return b;
}

const find = (seeds: Buffer[], programId: PublicKey) => PublicKey.findProgramAddressSync(seeds, programId)[0];

export const configPda = (programId: PublicKey) => find([utf8(SEED.config)], programId);

export const projectPda = (programId: PublicKey, producer: PublicKey, projectId: bigint | number) =>
  find([utf8(SEED.project), producer.toBuffer(), u64le(projectId)], programId);

export const fieldPda = (programId: PublicKey, project: PublicKey, index: number) =>
  find([utf8(SEED.field), project.toBuffer(), u8(index)], programId);

export const attestationPda = (programId: PublicKey, field: PublicKey, sequence: number) =>
  find([utf8(SEED.attestation), field.toBuffer(), u32le(sequence)], programId);

export const poolPda = (programId: PublicKey, poolId: bigint | number) =>
  find([utf8(SEED.pool), u64le(poolId)], programId);

export const mintPda = (programId: PublicKey, pool: PublicKey) => find([utf8(SEED.mint), pool.toBuffer()], programId);

export const investorPda = (programId: PublicKey, wallet: PublicKey) =>
  find([utf8(SEED.investor), wallet.toBuffer()], programId);

/** FeeConfig singleton. Fees are charged only while it exists. */
export const feesPda = (programId: PublicKey) => find([utf8(SEED.fees)], programId);

/** PoolTerms of a pool; absent for pools created before fees (arrangement fee 0). */
export const termsPda = (programId: PublicKey, pool: PublicKey) => find([utf8(SEED.terms), pool.toBuffer()], programId);

/** InstrumentTerms of a pool (ADR 0014); absent for pools without term-sheet terms. */
export const instrumentPda = (programId: PublicKey, pool: PublicKey) =>
  find([utf8(SEED.instrument), pool.toBuffer()], programId);
