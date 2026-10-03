import type { IdlAccounts } from "@anchor-lang/core";
import { kindFromAnchor, toHex, verdictFromAnchor, type AttestationKindName, type F2f, type VerdictName } from "@f2f/sdk";
import type { PublicKey } from "@solana/web3.js";
import { poolStatusFromAnchor, settlementFromAnchor, type PoolStatusName, type SettlementRuleName } from "./enums";

type Accounts = IdlAccounts<F2f>;
export type ConfigAccount = Accounts["config"];
export type PoolAccount = Accounts["pool"];
export type ProjectAccount = Accounts["farmProject"];
export type FieldAccount = Accounts["field"];
export type AttestationAccount = Accounts["attestation"];
export type InvestorRecordAccount = Accounts["investorRecord"];

export interface ConfigView { admin: string; issuer: string; scas: string; compliance: string; usdcMint: string }
export interface InstrumentView { name: string; symbol: string; uri: string; supply: string; decimals: number }
export interface PoolView {
  address: string;
  poolId: string;
  issuer: string;
  mint: string;
  vault: string;
  crop: string;
  season: number;
  targetAmount: string;
  raisedAmount: string;
  yieldBps: number;
  premiumBps: number;
  subscriptionCloseTs: number;
  maturityTs: number;
  projectCount: number;
  disbursedCount: number;
  settledCount: number;
  status: PoolStatusName;
  instrument: InstrumentView | null;
}
export interface ProjectView {
  address: string;
  producer: string;
  projectId: string;
  pool: string | null;
  crop: string;
  season: number;
  expectedKg: string;
  tokenizedKg: string;
  requestedAmount: string;
  fieldCount: number;
  verifiedFieldCount: number;
  harvestAttested: boolean;
  disbursed: boolean;
  settlement: SettlementRuleName | null;
}
export interface FieldView {
  address: string;
  project: string;
  index: number;
  polygonHash: string;
  areaHaX100: number;
  verified: boolean;
  attestationCount: number;
}
export interface AttestationView {
  address: string;
  field: string;
  project: string;
  sequence: number;
  kind: AttestationKindName;
  verdict: VerdictName;
  evidenceHash: string;
  evidenceUri: string;
  ndviMeanX10k: number;
  sceneDate: number;
  signer: string;
  recordedAt: number;
}
export type ProjectWithFields = ProjectView & { fields: FieldView[] };
export interface PoolDetail { pool: PoolView; projects: ProjectWithFields[] }
export interface FieldDetail { field: FieldView; project: ProjectView; pool: PoolView | null; attestations: AttestationView[] }
export interface PositionView {
  poolId: string;
  pool: string;
  symbol: string;
  status: PoolStatusName;
  yieldBps: number;
  ata: string;
  exists: boolean;
  frozen: boolean;
  balance: string;
}
export interface InvestorState {
  wallet: string;
  approved: boolean;
  approvedAt: number | null;
  usdcBalance: string;
  solLamports: number;
  positions: PositionView[];
}

export const toConfigView = (a: ConfigAccount): ConfigView => ({
  admin: a.admin.toBase58(),
  issuer: a.issuer.toBase58(),
  scas: a.scas.toBase58(),
  compliance: a.compliance.toBase58(),
  usdcMint: a.usdcMint.toBase58(),
});

export function toPoolView(address: PublicKey, a: PoolAccount, instrument: InstrumentView | null): PoolView {
  return {
    address: address.toBase58(),
    poolId: a.poolId.toString(),
    issuer: a.issuer.toBase58(),
    mint: a.mint.toBase58(),
    vault: a.vault.toBase58(),
    crop: a.crop,
    season: a.season,
    targetAmount: a.targetAmount.toString(),
    raisedAmount: a.raisedAmount.toString(),
    yieldBps: a.yieldBps,
    premiumBps: a.premiumBps,
    subscriptionCloseTs: a.subscriptionCloseTs.toNumber(),
    maturityTs: a.maturityTs.toNumber(),
    projectCount: a.projectCount,
    disbursedCount: a.disbursedCount,
    settledCount: a.settledCount,
    status: poolStatusFromAnchor(a.status),
    instrument,
  };
}

export function toProjectView(address: PublicKey, a: ProjectAccount): ProjectView {
  return {
    address: address.toBase58(),
    producer: a.producer.toBase58(),
    projectId: a.projectId.toString(),
    pool: a.pool ? a.pool.toBase58() : null,
    crop: a.crop,
    season: a.season,
    expectedKg: a.expectedKg.toString(),
    tokenizedKg: a.tokenizedKg.toString(),
    requestedAmount: a.requestedAmount.toString(),
    fieldCount: a.fieldCount,
    verifiedFieldCount: a.verifiedFieldCount,
    harvestAttested: a.harvestAttested,
    disbursed: a.disbursed,
    settlement: a.settlement ? settlementFromAnchor(a.settlement) : null,
  };
}

export function toFieldView(address: PublicKey, a: FieldAccount): FieldView {
  return {
    address: address.toBase58(),
    project: a.project.toBase58(),
    index: a.index,
    polygonHash: toHex(Uint8Array.from(a.polygonHash)),
    areaHaX100: a.areaHaX100,
    verified: a.verified,
    attestationCount: a.attestationCount,
  };
}

export function toAttestationView(address: PublicKey, a: AttestationAccount): AttestationView {
  return {
    address: address.toBase58(),
    field: a.field.toBase58(),
    project: a.project.toBase58(),
    sequence: a.sequence,
    kind: kindFromAnchor(a.kind),
    verdict: verdictFromAnchor(a.verdict),
    evidenceHash: toHex(Uint8Array.from(a.evidenceHash)),
    evidenceUri: a.evidenceUri,
    ndviMeanX10k: a.ndviMeanX10k,
    sceneDate: a.sceneDate.toNumber(),
    signer: a.signer.toBase58(),
    recordedAt: a.recordedAt.toNumber(),
  };
}

export type ProducerProject = ProjectWithFields & { poolId: string | null; poolStatus: PoolStatusName | null; symbol: string | null };
