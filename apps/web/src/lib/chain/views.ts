import type { IdlAccounts } from "@anchor-lang/core";
import {
  dayCountFromAnchor,
  electionFromAnchor,
  kindFromAnchor,
  settlementModeFromAnchor,
  toHex,
  verdictFromAnchor,
  type AttestationKindName,
  type DayCountName,
  type F2f,
  type SettlementElectionName,
  type SettlementModeName,
  type VerdictName,
} from "@f2f/sdk";
import type { PublicKey } from "@solana/web3.js";
import { poolStatusFromAnchor, settlementFromAnchor, type PoolStatusName, type SettlementRuleName } from "./enums";

type Accounts = IdlAccounts<F2f>;
export type ConfigAccount = Accounts["config"];
export type PoolAccount = Accounts["pool"];
export type ProjectAccount = Accounts["farmProject"];
export type FieldAccount = Accounts["field"];
export type AttestationAccount = Accounts["attestation"];
export type InvestorRecordAccount = Accounts["investorRecord"];
export type InstrumentTermsAccount = Accounts["instrumentTerms"];

/** InstrumentTerms (ADR 0014): amounts in USDC base units and kg as strings, hashes as hex (null while zero). */
export interface InstrumentTermsView {
  unitNominal: string;
  couponBpsAnnual: number;
  dayCount: DayCountName;
  startTs: number;
  settlementMode: SettlementModeName;
  volumeKg: string;
  tokenizedShareBps: number;
  qualitySpecHash: string;
  specUri: string;
  elevator: string;
  lab: string;
  election: SettlementElectionName | null;
  electedAt: number;
  receiptHash: string | null;
  labCertHash: string | null;
  labPassed: boolean;
  deliveredKg: string;
}

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
  /** Term-sheet terms; null for pools created without them, absent when not loaded. */
  terms?: InstrumentTermsView | null;
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
/** `arrangementFeeBps` comes from the pool's PoolTerms; 0 for pools created before fees (ADR 0013). */
export interface PoolDetail {
  pool: PoolView;
  projects: ProjectWithFields[];
  arrangementFeeBps: number;
  /** InstrumentTerms (ADR 0014); null for pools without them. */
  terms?: InstrumentTermsView | null;
  /** Whether `pool.issuer` (the issuer of record) holds an approved KYC record. */
  issuerKycApproved?: boolean;
}
/** FeeConfig (ADR 0013); amounts in USDC base units. */
export interface FeeView { treasury: string; networkFee: string; mintFee: string; maxArrangementBps: number }
export type FeeStatus = FeeView & { treasuryUsdc: string };
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
  /** Cash due at maturity for this balance: Act/360 coupon for term-sheet pools, else the flat yield. */
  atMaturity?: string;
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

const hexOrNull = (bytes: number[]) => (bytes.every((b) => b === 0) ? null : toHex(Uint8Array.from(bytes)));

export function toInstrumentTermsView(a: InstrumentTermsAccount): InstrumentTermsView {
  return {
    unitNominal: a.unitNominal.toString(),
    couponBpsAnnual: a.couponBpsAnnual,
    dayCount: dayCountFromAnchor(a.dayCount),
    startTs: a.startTs.toNumber(),
    settlementMode: settlementModeFromAnchor(a.settlementMode),
    volumeKg: a.volumeKg.toString(),
    tokenizedShareBps: a.tokenizedShareBps,
    qualitySpecHash: toHex(Uint8Array.from(a.qualitySpecHash)),
    specUri: a.specUri,
    elevator: a.elevator,
    lab: a.lab,
    election: a.election ? electionFromAnchor(a.election) : null,
    electedAt: a.electedAt.toNumber(),
    receiptHash: hexOrNull(a.receiptHash),
    labCertHash: hexOrNull(a.labCertHash),
    labPassed: a.labPassed,
    deliveredKg: a.deliveredKg.toString(),
  };
}
