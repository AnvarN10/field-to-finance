import { PILOT_QUALITY_SPEC, canonicalJson, sha256, toHex } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import {
  FARMER_REQUIREMENTS,
  documentKey,
  onboardingStatus,
  readOnboarding,
  recordOnboardingDocument,
  storeDeliveryEvidence,
  storeDocument,
  storeQualitySpec,
} from "../src/lib/pilot-docs";
import { MemoryStore, evidenceKey, serveHashed } from "../src/lib/store";

const WALLET = "9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm";
const pdf = new TextEncoder().encode("%PDF-1.7 test");

describe("pilot documents", () => {
  it("lists the farmer requirements of the term sheet; KYC comes from the platform record", () => {
    expect(FARMER_REQUIREMENTS.map((r) => r.key)).toEqual(["insurance", "land_use_right", "financial_statements", "historical_yields", "field_imagery"]);
  });

  it("stores a document under its SHA-256 and refuses other types and big files", async () => {
    const store = new MemoryStore();
    const d = await storeDocument(store, pdf, "application/pdf");
    expect(d.sha256).toBe(toHex(sha256(pdf)));
    expect(store.objects.has(documentKey(d.sha256))).toBe(true);
    await expect(storeDocument(store, pdf, "text/html")).rejects.toMatchObject({ status: 415 });
    await expect(storeDocument(store, new Uint8Array(10 * 1024 * 1024 + 1), "application/pdf")).rejects.toMatchObject({ status: 413 });
  });

  it("keeps the onboarding checklist per wallet without file names or personal data", async () => {
    const store = new MemoryStore();
    expect((await readOnboarding(store, WALLET)).documents).toEqual({});
    await recordOnboardingDocument(store, WALLET, "insurance", pdf, "application/pdf", 1_800_000_000);
    const m = await readOnboarding(store, WALLET);
    expect(m.documents.insurance).toEqual({ sha256: toHex(sha256(pdf)), size: pdf.length, contentType: "application/pdf", uploadedAt: 1_800_000_000 });
    const rows = onboardingStatus(m, true);
    expect(rows.find((r) => r.key === "insurance")?.status).toBe("provided");
    expect(rows.find((r) => r.key === "field_imagery")?.status).toBe("missing");
    expect(rows.at(-1)).toMatchObject({ key: "kyc", status: "provided" });
    await expect(recordOnboardingDocument(store, WALLET, "passport" as never, pdf, "application/pdf", 1)).rejects.toMatchObject({ status: 400 });
    await expect(readOnboarding(store, "not a wallet")).rejects.toMatchObject({ status: 400 });
  });

  it("stores the quality spec as canonical JSON served by the evidence route", async () => {
    const store = new MemoryStore();
    const r = await storeQualitySpec(store, PILOT_QUALITY_SPEC, "https://f2f.example/");
    expect(r.hash).toBe(toHex(sha256(canonicalJson(PILOT_QUALITY_SPEC))));
    expect(r.uri).toBe(`https://f2f.example/api/evidence/${r.hash}`);
    expect(store.objects.has(evidenceKey(r.hash))).toBe(true);
  });

  it("stores delivery evidence that points at the private document by hash", async () => {
    const store = new MemoryStore();
    const doc = await storeDocument(store, pdf, "application/pdf");
    const r = await storeDeliveryEvidence(store, { kind: "ElevatorReceipt", verdict: "Pass", poolId: "9", documentSha256: doc.sha256, kg: "3000000" }, "https://f2f.example", 1_800_000_000);
    const body = JSON.parse(new TextDecoder().decode(store.objects.get(evidenceKey(r.hash))!));
    expect(body).toMatchObject({ kind: "ElevatorReceipt", verdict: "Pass", poolId: "9", documentSha256: doc.sha256, kg: "3000000" });
  });

  it("serves hashed objects as private, so no shared cache keeps them past basic auth", async () => {
    const store = new MemoryStore();
    const r = await storeQualitySpec(store, PILOT_QUALITY_SPEC, "https://f2f.example");
    const res = await serveHashed(store, evidenceKey(r.hash), r.hash);
    expect(res.headers.get("cache-control")).toMatch(/^private/);
  });
});

describe("field sets", () => {
  it("stores imported fields with cadastral numbers in the bucket, content-addressed, and reads them back", async () => {
    const { storeFieldSet, loadFieldSet } = await import("../src/lib/pilot-docs");
    const store = new MemoryStore();
    const entries = [{ polygonHash: "ab".repeat(32), areaHaX100: 12_345, name: "North", cadastralNumber: "05-000-000-001", declaredAreaHa: 123.4 }];
    const { hash } = await storeFieldSet(store, entries);
    expect(await loadFieldSet(store, hash)).toEqual({ version: 1, fields: entries });
    await expect(storeFieldSet(store, [{ ...entries[0]!, polygonHash: "nope" }])).rejects.toMatchObject({ status: 400 });
    expect(await loadFieldSet(store, "0".repeat(64))).toBeNull();
  });
});
