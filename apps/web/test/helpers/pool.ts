import type { FieldView, InstrumentTermsView, PoolDetail, PoolView, ProjectWithFields } from "../../src/lib/chain/views";
import { FARMER_WALLET, PROJECT } from "./workflow";

export const POOL_ADDRESS = "Poo1Address11111111111111111111111111111111";
export const NOW = 1_800_000_000;

export function field(over: Partial<FieldView> = {}): FieldView {
  return { address: "Fie1d0111111111111111111111111111111111111", project: PROJECT, index: 0, polygonHash: "ab".repeat(32), areaHaX100: 12_000, verified: true, attestationCount: 1, ...over };
}

export function terms(over: Partial<InstrumentTermsView> = {}): InstrumentTermsView {
  return {
    unitNominal: "100000000",
    couponBpsAnnual: 1200,
    dayCount: "Act360",
    startTs: NOW - 86_400,
    settlementMode: "Hybrid",
    volumeKg: "100000",
    tokenizedShareBps: 3000,
    qualitySpecHash: "cd".repeat(32),
    specUri: "http://localhost/api/evidence/x",
    elevator: "Demo elevator",
    lab: "Demo lab",
    election: null,
    electedAt: 0,
    receiptHash: null,
    labCertHash: null,
    labPassed: false,
    deliveredKg: "0",
    ...over,
  };
}

export function poolView(over: Partial<PoolView> = {}): PoolView {
  return {
    address: POOL_ADDRESS,
    poolId: "9",
    issuer: FARMER_WALLET,
    mint: "Mint111111111111111111111111111111111111111",
    vault: "Vau1t11111111111111111111111111111111111111",
    crop: "wheat",
    season: 2027,
    targetAmount: "1000000000",
    raisedAmount: "1000000000",
    yieldBps: 1200,
    premiumBps: 500,
    subscriptionCloseTs: NOW - 3_600,
    maturityTs: NOW + 30 * 86_400,
    projectCount: 1,
    disbursedCount: 1,
    settledCount: 0,
    status: "Funded",
    instrument: { name: "Demo wheat", symbol: "DWHT27", uri: "", supply: "1000000000", decimals: 6 },
    terms: null,
    ...over,
  };
}

export function projectWith(over: Partial<ProjectWithFields> = {}): ProjectWithFields {
  return {
    address: PROJECT,
    producer: FARMER_WALLET,
    projectId: "1",
    pool: POOL_ADDRESS,
    crop: "wheat",
    season: 2027,
    expectedKg: "1000000",
    tokenizedKg: "300000",
    requestedAmount: "1000000000",
    fieldCount: 1,
    verifiedFieldCount: 1,
    harvestAttested: false,
    disbursed: true,
    settlement: null,
    fields: [field()],
    ...over,
  };
}

/** A term-sheet pool, Funded and disbursed, a month before maturity. Override any part. */
export function poolDetail(o: { pool?: Partial<PoolView>; terms?: Partial<InstrumentTermsView> | null; projects?: ProjectWithFields[] } = {}): PoolDetail {
  const t = o.terms === null ? null : terms(o.terms ?? {});
  return { pool: { ...poolView(o.pool), terms: t }, projects: o.projects ?? [projectWith()], arrangementFeeBps: 200, terms: t, issuerKycApproved: true };
}
