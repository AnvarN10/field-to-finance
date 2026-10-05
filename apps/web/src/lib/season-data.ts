import type { InstrumentTermsView } from "./chain/views";
import type { DeliveryEvidence } from "./pilot-docs";
import { evidenceKey, readHashed, type BlobStore } from "./store";

async function evidence(store: BlobStore, hash: string | null): Promise<DeliveryEvidence | null> {
  if (!hash) return null;
  const bytes = await readHashed(store, evidenceKey(hash), hash).catch(() => null);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as DeliveryEvidence;
  } catch {
    return null;
  }
}

/** The elevator receipt and lab protocol evidence a pool's InstrumentTerms point at; a missing or altered file reads as null. */
export async function deliveryRecords(store: BlobStore, t: InstrumentTermsView | null | undefined): Promise<{ receipt: DeliveryEvidence | null; quality: DeliveryEvidence | null }> {
  if (!t) return { receipt: null, quality: null };
  const [receipt, quality] = await Promise.all([evidence(store, t.receiptHash), evidence(store, t.labCertHash)]);
  return { receipt, quality };
}
