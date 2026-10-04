import { canonicalJson, sha256, toHex, type QualitySpec } from "@f2f/sdk";
import { RequestError } from "./errors";
import { evidenceKey, type BlobStore } from "./store";

/**
 * Pilot documents (ADR 0014). Farmer documents and delivery papers live in the bucket, keyed by
 * their SHA-256; only hashes ever reach the chain. Nothing here stores names or personal data:
 * the onboarding manifest records requirement, hash, size, type and time.
 */
export const FARMER_REQUIREMENTS = [
  { key: "insurance", label: "Crop insurance" },
  { key: "land_use_right", label: "Land-use right: state act and cadastral numbers" },
  { key: "financial_statements", label: "Financial statements: 4 forms, payables incl. loans, encumbrance certificate" },
  { key: "historical_yields", label: "Historical field yields" },
  { key: "field_imagery", label: "Field imagery" },
] as const;
export type RequirementKey = (typeof FARMER_REQUIREMENTS)[number]["key"];

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const documentKey = (hashHex: string) => `documents/${hashHex}`;
export const onboardingKey = (wallet: string) => `onboarding/${wallet}.json`;

export interface StoredDocument {
  sha256: string;
  size: number;
  contentType: string;
}

export async function storeDocument(store: BlobStore, bytes: Uint8Array, contentType: string): Promise<StoredDocument> {
  if (!DOCUMENT_TYPES.has(contentType)) throw new RequestError("Upload a PDF, image, CSV, XLSX, DOCX or ZIP file", 415);
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new RequestError("Documents are limited to 10 MB", 413);
  if (bytes.length === 0) throw new RequestError("The file is empty", 400);
  const hash = toHex(sha256(bytes));
  await store.put(documentKey(hash), bytes, contentType);
  return { sha256: hash, size: bytes.length, contentType };
}

export interface OnboardingManifest {
  wallet: string;
  documents: Partial<Record<RequirementKey, StoredDocument & { uploadedAt: number }>>;
}

function assertWallet(wallet: string): void {
  if (!WALLET.test(wallet)) throw new RequestError("Invalid wallet address", 400);
}

export async function readOnboarding(store: BlobStore, wallet: string): Promise<OnboardingManifest> {
  assertWallet(wallet);
  const bytes = await store.get(onboardingKey(wallet));
  if (!bytes) return { wallet, documents: {} };
  return JSON.parse(new TextDecoder().decode(bytes)) as OnboardingManifest;
}

/** Stores the file and points the wallet's checklist entry at it. The manifest is the one mutable object. */
export async function recordOnboardingDocument(
  store: BlobStore,
  wallet: string,
  requirement: RequirementKey,
  bytes: Uint8Array,
  contentType: string,
  now: number,
): Promise<OnboardingManifest> {
  if (!FARMER_REQUIREMENTS.some((r) => r.key === requirement)) throw new RequestError("Unknown requirement", 400);
  const manifest = await readOnboarding(store, wallet);
  const doc = await storeDocument(store, bytes, contentType);
  manifest.documents[requirement] = { ...doc, uploadedAt: now };
  await store.put(onboardingKey(wallet), new TextEncoder().encode(canonicalJson(manifest)), "application/json");
  return manifest;
}

export interface RequirementRow {
  key: RequirementKey | "kyc";
  label: string;
  status: "provided" | "missing";
  sha256?: string;
}

export function onboardingStatus(m: OnboardingManifest, kycApproved: boolean): RequirementRow[] {
  return [
    ...FARMER_REQUIREMENTS.map((r): RequirementRow => {
      const d = m.documents[r.key];
      return d ? { key: r.key, label: r.label, status: "provided", sha256: d.sha256 } : { key: r.key, label: r.label, status: "missing" };
    }),
    { key: "kyc", label: "Full KYC of the issuer", status: kycApproved ? "provided" : "missing" },
  ];
}

const base = (url: string) => url.replace(/\/+$/, "");

async function putEvidence(store: BlobStore, value: unknown, publicBaseUrl: string): Promise<{ hash: string; uri: string }> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hash = toHex(sha256(bytes));
  await store.put(evidenceKey(hash), bytes, "application/json");
  return { hash, uri: `${base(publicBaseUrl)}/api/evidence/${hash}` };
}

/** Quality spec JSON; its hash goes on-chain as `quality_spec_hash`. */
export const storeQualitySpec = (store: BlobStore, spec: QualitySpec, publicBaseUrl: string) => putEvidence(store, spec, publicBaseUrl);

export interface DeliveryEvidence {
  kind: "ElevatorReceipt" | "LabQuality";
  verdict: "Pass" | "Fail" | "InsufficientData";
  poolId: string;
  /** SHA-256 of the receipt or certificate file in `documents/` (served to the admin console only). */
  documentSha256: string;
  kg?: string;
}

/** Evidence JSON for a delivery attestation; readable past basic auth, the document itself is not. */
export const storeDeliveryEvidence = (store: BlobStore, e: DeliveryEvidence, publicBaseUrl: string, now: number) =>
  putEvidence(store, { version: 1, ...e, recordedAt: now }, publicBaseUrl);
