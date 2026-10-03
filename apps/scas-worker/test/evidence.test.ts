import { canonicalJson, sha256, toHex } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import {
  encodeEvidence,
  evidenceKey,
  evidenceUri,
  ndviToX10k,
  polygonKey,
  sceneDateToUnix,
  type EvidenceDoc,
} from "../src/evidence";
import { SQUARE } from "./helpers";

const DOC: EvidenceDoc = {
  schema: "f2f-scas-evidence/1",
  rulesVersion: "f2f-scas-rules/1",
  replay: false,
  generatedAt: "2026-10-03T09:00:00.000Z",
  network: { cluster: "devnet", programId: "9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm" },
  subject: {
    project: "Proj1111111111111111111111111111111111111111",
    field: "Fld11111111111111111111111111111111111111111",
    fieldIndex: 0,
    crop: "wheat",
    season: 2027,
    declaredAreaHa: 76.11,
    polygonHash: "ab".repeat(32),
  },
  kind: "FieldVerified",
  asOf: "2026-10-03",
  window: { from: "2026-07-06T00:00:00Z", to: "2026-10-04T00:00:00Z" },
  polygon: SQUARE,
  geometry: { valid: true, areaHa: 76.11, reasons: [] },
  request: null,
  response: null,
  scenes: [],
  failedIntervals: [],
  decision: { verdict: "InsufficientData", ndviMean: null, sceneDate: null, reasons: ["no clear scene"] },
  onChain: { ndviMeanX10k: 0, sceneDate: 0 },
  signer: "Scas111111111111111111111111111111111111111",
};

describe("encodeEvidence", () => {
  it("hashes the canonical JSON bytes", () => {
    const enc = encodeEvidence(DOC);
    expect(new TextDecoder().decode(enc.bytes)).toBe(canonicalJson(DOC));
    expect(enc.hashHex).toBe(toHex(sha256(canonicalJson(DOC))));
    expect(enc.hash).toHaveLength(32);
  });

  it("is independent of key order", () => {
    const reordered = Object.fromEntries(Object.entries(DOC).reverse()) as unknown as EvidenceDoc;
    expect(encodeEvidence(reordered).hashHex).toBe(encodeEvidence(DOC).hashHex);
  });
});

describe("evidence addressing", () => {
  it("keys objects by hash", () => {
    expect(evidenceKey("ab".repeat(32))).toBe(`evidence/${"ab".repeat(32)}.json`);
    expect(polygonKey("cd".repeat(32))).toBe(`polygons/${"cd".repeat(32)}.json`);
  });

  it("builds a URI that fits the program's 128-byte limit", () => {
    const uri = evidenceUri("https://scas.example.app/", "ab".repeat(32));
    expect(uri).toBe(`https://scas.example.app/e/${"ab".repeat(32)}`);
    expect(() => evidenceUri(`https://${"a".repeat(60)}.app`, "ab".repeat(32))).toThrow(/128/);
  });
});

describe("on-chain scaling", () => {
  it("scales NDVI to x10 000 and clamps", () => {
    expect(ndviToX10k(0.19)).toBe(1900);
    expect(ndviToX10k(-0.12346)).toBe(-1235);
    expect(ndviToX10k(1.2)).toBe(10_000);
    expect(ndviToX10k(null)).toBe(0);
  });

  it("converts scene days to unix seconds at UTC midnight", () => {
    expect(sceneDateToUnix("2026-09-20")).toBe(1789862400);
    expect(sceneDateToUnix(null)).toBe(0);
  });
});
