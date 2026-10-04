import "server-only";
import type { QualitySpec } from "@f2f/sdk";
import type { PoolDetail } from "../chain/views";
import { onboardingStatus, readOnboarding, type RequirementRow } from "../pilot-docs";
import { evidenceKey, readHashed, type BlobStore } from "../store";

/** Quality spec and farmer checklist for a pool with InstrumentTerms; missing bucket objects degrade to null. */
export async function termSheetData(store: BlobStore, detail: PoolDetail): Promise<{ spec: QualitySpec | null; requirements: RequirementRow[] | null }> {
  if (!detail.terms) return { spec: null, requirements: null };
  const [spec, requirements] = await Promise.all([
    readHashed(store, evidenceKey(detail.terms.qualitySpecHash), detail.terms.qualitySpecHash)
      .then((b) => (b ? (JSON.parse(new TextDecoder().decode(b)) as QualitySpec) : null))
      .catch(() => null),
    readOnboarding(store, detail.pool.issuer)
      .then((m) => onboardingStatus(m, detail.issuerKycApproved ?? false))
      .catch(() => null),
  ]);
  return { spec, requirements };
}
