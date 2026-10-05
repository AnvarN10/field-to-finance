import { canonicalJson, sha256, toHex } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import { deliveryRecords } from "../src/lib/season-data";
import { evidenceKey, MemoryStore } from "../src/lib/store";
import { terms } from "./helpers/pool";

async function put(store: MemoryStore, doc: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(doc));
  const h = toHex(sha256(bytes));
  await store.put(evidenceKey(h), bytes, "application/json");
  return h;
}

describe("deliveryRecords", () => {
  it("reads the receipt and lab evidence by their on-chain hashes", async () => {
    const store = new MemoryStore();
    const receiptHash = await put(store, { version: 1, kind: "ElevatorReceipt", verdict: "Pass", poolId: "9", documentSha256: "aa".repeat(32), kg: "950000" });
    const labHash = await put(store, { version: 1, kind: "LabQuality", verdict: "Fail", poolId: "9", documentSha256: "bb".repeat(32), results: [] });
    const r = await deliveryRecords(store, terms({ receiptHash, labCertHash: labHash }));
    expect(r.receipt).toMatchObject({ kind: "ElevatorReceipt", kg: "950000" });
    expect(r.quality).toMatchObject({ kind: "LabQuality", verdict: "Fail" });
  });

  it("returns nulls for missing, tampered or absent records", async () => {
    const store = new MemoryStore();
    await store.put(evidenceKey("ab".repeat(32)), new TextEncoder().encode("{}"), "application/json");
    expect(await deliveryRecords(store, terms({ receiptHash: "ab".repeat(32), labCertHash: "cd".repeat(32) }))).toEqual({ receipt: null, quality: null });
    expect(await deliveryRecords(store, null)).toEqual({ receipt: null, quality: null });
  });
});
