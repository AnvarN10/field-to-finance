import { polygonHash, toHex } from "@f2f/sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAsOf, runAttestation, type AttestDeps } from "../src/attest";
import type { AttestationArgs, Chain, FieldState } from "../src/chain";
import { RequestError, SentinelError } from "../src/errors";
import { evidenceKey, polygonKey, type EvidenceDoc } from "../src/evidence";
import { CDSE_TOKEN_URL, SentinelClient, type StatsSource } from "../src/sentinel/client";
import { MemoryStore } from "../src/store";
import clear from "./fixtures/stats-clear.json";
import cloudy from "./fixtures/stats-cloudy.json";
import empty from "./fixtures/stats-empty.json";
import partial from "./fixtures/stats-partial-error.json";
import { BOWTIE, SQUARE, SQUARE_AREA_HA_X100 } from "./helpers";

const PROGRAM_ID = new PublicKey("9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm");
const PROJECT = Keypair.generate().publicKey;
const FIELD = Keypair.generate().publicKey;
const SCAS = Keypair.generate().publicKey;
const NOW = new Date("2026-10-03T09:00:00Z");

function fakeChain(field: Partial<FieldState> = {}) {
  const sent: Omit<AttestationArgs, "sequence">[] = [];
  const chain: Chain = {
    scas: SCAS,
    loadProject: async () => ({ address: PROJECT, crop: "wheat", season: 2027 }),
    loadField: async (_project, index) => ({
      address: FIELD,
      project: PROJECT,
      index,
      polygonHash: polygonHash(SQUARE),
      areaHaX100: SQUARE_AREA_HA_X100,
      verified: false,
      attestationCount: 0,
      ...field,
    }),
    assertScasAuthority: async () => {},
    sendAttestation: async (args) => {
      sent.push(args);
      return { signature: "sig-1", attestation: Keypair.generate().publicKey, sequence: 0 };
    },
  };
  return { chain, sent };
}

const source = (response: unknown): StatsSource & { calls: number } => {
  const s = {
    calls: 0,
    fetchStats: async () => {
      s.calls += 1;
      return response;
    },
  };
  return s;
};

let store: MemoryStore;
beforeEach(() => {
  store = new MemoryStore();
});

function deps(chain: Chain, sentinel: StatsSource): AttestDeps {
  return { chain, sentinel, store, evidenceBaseUrl: "https://scas.example.app", programId: PROGRAM_ID, cluster: "devnet", now: () => NOW };
}

const storedEvidence = (hashHex: string): EvidenceDoc => {
  const bytes = store.objects.get(evidenceKey(hashHex))?.body;
  if (!bytes) throw new Error("evidence not stored");
  return JSON.parse(new TextDecoder().decode(bytes)) as EvidenceDoc;
};

describe("FieldVerified", () => {
  it("clear scene: stores evidence, then signs Pass with the latest clear NDVI", async () => {
    const { chain, sent } = fakeChain();
    const result = await runAttestation(deps(chain, source(clear)), {
      project: PROJECT,
      fieldIndex: 0,
      kind: "FieldVerified",
      polygon: SQUARE,
    });
    expect(result).toMatchObject({
      verdict: "Pass",
      ndviMeanX10k: 1900,
      sceneDate: "2026-09-20",
      sceneDateUnix: 1789862400,
      replay: false,
      signature: "sig-1",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ field: FIELD, kind: "FieldVerified", verdict: "Pass", evidenceUri: result.evidenceUri });
    expect(toHex(sent[0]!.evidenceHash)).toBe(result.evidenceHash);
    const doc = storedEvidence(result.evidenceHash);
    expect(doc.scenes).toHaveLength(3);
    expect(doc.request?.aggregation.aggregationInterval).toEqual({ of: "P1D" });
    expect(store.objects.has(polygonKey(toHex(polygonHash(SQUARE))))).toBe(true);
  });

  it("cloudy scenes: signs InsufficientData with zero NDVI and scene date", async () => {
    const { chain, sent } = fakeChain();
    const result = await runAttestation(deps(chain, source(cloudy)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE });
    expect(result.verdict).toBe("InsufficientData");
    expect(sent[0]).toMatchObject({ verdict: "InsufficientData", ndviMeanX10k: 0, sceneDate: 0 });
  });

  it("no scenes: signs InsufficientData", async () => {
    const { chain } = fakeChain();
    const result = await runAttestation(deps(chain, source(empty)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE });
    expect(result.verdict).toBe("InsufficientData");
  });

  it("area mismatch: signs Fail", async () => {
    const { chain } = fakeChain({ areaHaX100: 9000 });
    const result = await runAttestation(deps(chain, source(clear)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE });
    expect(result.verdict).toBe("Fail");
    expect(result.reasons[0]).toMatch(/differs from declared 90 ha/);
  });

  it("invalid polygon: signs Fail without calling the API", async () => {
    const { chain, sent } = fakeChain({ polygonHash: polygonHash(BOWTIE) });
    const sentinel = source(clear);
    const result = await runAttestation(deps(chain, sentinel), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: BOWTIE });
    expect(result.verdict).toBe("Fail");
    expect(sentinel.calls).toBe(0);
    expect(sent).toHaveLength(1);
    expect(storedEvidence(result.evidenceHash).request).toBeNull();
  });

  it("never stores a credential in the evidence", async () => {
    const { chain } = fakeChain();
    const result = await runAttestation(deps(chain, source(clear)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE });
    const json = new TextDecoder().decode(store.objects.get(evidenceKey(result.evidenceHash))?.body);
    expect(json).not.toMatch(/Bearer|client_secret|access_token/);
  });
});

describe("failures never sign", () => {
  it("Statistical API failure: rejects, stores no evidence, sends nothing", async () => {
    const { chain, sent } = fakeChain();
    const failing: StatsSource = {
      fetchStats: async () => {
        throw new SentinelError("Statistical API returned 503: down", { retryable: true, status: 503 });
      },
    };
    await expect(
      runAttestation(deps(chain, failing), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE }),
    ).rejects.toBeInstanceOf(SentinelError);
    expect(sent).toHaveLength(0);
    expect([...store.objects.keys()].some((k) => k.startsWith("evidence/"))).toBe(false);
  });

  it("API 500 then success through the real client: signs once", async () => {
    const { chain, sent } = fakeChain();
    let statsCalls = 0;
    const fetch = (async (input: string | URL | Request) => {
      if (String(input) === CDSE_TOKEN_URL) return Response.json({ access_token: "t", expires_in: 600 });
      statsCalls += 1;
      return statsCalls === 1 ? new Response("boom", { status: 500 }) : Response.json(clear);
    }) as typeof globalThis.fetch;
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep: vi.fn(async () => {}) });
    const result = await runAttestation(deps(chain, client), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE });
    expect(result.verdict).toBe("Pass");
    expect(statsCalls).toBe(2);
    expect(sent).toHaveLength(1);
  });

  it("API failing on every attempt through the real client: sends nothing", async () => {
    const { chain, sent } = fakeChain();
    const fetch = (async (input: string | URL | Request) =>
      String(input) === CDSE_TOKEN_URL
        ? Response.json({ access_token: "t", expires_in: 600 })
        : new Response("down", { status: 502 })) as typeof globalThis.fetch;
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep: vi.fn(async () => {}) });
    await expect(
      runAttestation(deps(chain, client), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE }),
    ).rejects.toThrow(/returned 502/);
    expect(sent).toHaveLength(0);
  });

  it("polygon that does not match the on-chain hash: 409 before any API call", async () => {
    const { chain, sent } = fakeChain({ polygonHash: new Uint8Array(32) });
    const sentinel = source(clear);
    await expect(
      runAttestation(deps(chain, sentinel), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE }),
    ).rejects.toMatchObject({ status: 409 });
    expect(sentinel.calls).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("no polygon in the request and none stored: 404", async () => {
    const { chain } = fakeChain();
    await expect(
      runAttestation(deps(chain, source(clear)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("polygon from the bucket, dry run and replay", () => {
  it("loads the polygon stored under the on-chain hash", async () => {
    const { chain, sent } = fakeChain();
    await store.put(polygonKey(toHex(polygonHash(SQUARE))), new TextEncoder().encode(JSON.stringify(SQUARE)), "application/geo+json");
    await runAttestation(deps(chain, source(clear)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified" });
    expect(sent).toHaveLength(1);
  });

  it("dry run computes the evidence hash but stores and signs nothing", async () => {
    const { chain, sent } = fakeChain();
    const result = await runAttestation(deps(chain, source(clear)), {
      project: PROJECT,
      fieldIndex: 0,
      kind: "FieldVerified",
      polygon: SQUARE,
      dryRun: true,
    });
    expect(result).toMatchObject({ dryRun: true, signature: null, verdict: "Pass" });
    expect(result.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.objects.size).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("replays last season's Vegetation and labels the evidence", async () => {
    const { chain, sent } = fakeChain();
    const result = await runAttestation(deps(chain, source(partial)), {
      project: PROJECT,
      fieldIndex: 0,
      kind: "Vegetation",
      replayDate: "2026-07-12",
      polygon: SQUARE,
    });
    expect(result).toMatchObject({ verdict: "Pass", replay: true, asOf: "2026-07-12", ndviMeanX10k: 7200 });
    expect(sent[0]?.sceneDate).toBe(1783641600);
    const doc = storedEvidence(result.evidenceHash);
    expect(doc.replay).toBe(true);
    expect(doc.window).toEqual({ from: "2026-06-23T00:00:00Z", to: "2026-07-13T00:00:00Z" });
    expect(doc.failedIntervals).toHaveLength(1);
  });
});

describe("resolveAsOf", () => {
  it("uses now without a replay date", () => {
    expect(resolveAsOf("FieldVerified", undefined, NOW)).toEqual({ asOf: NOW, replay: false });
  });

  it("refuses a replay date for FieldVerified, malformed or impossible dates, and future dates", () => {
    expect(() => resolveAsOf("FieldVerified", "2026-07-12", NOW)).toThrow(RequestError);
    expect(() => resolveAsOf("Vegetation", "12.07.2026", NOW)).toThrow(/YYYY-MM-DD/);
    expect(() => resolveAsOf("Vegetation", "2026-02-30", NOW)).toThrow(/YYYY-MM-DD/);
    expect(() => resolveAsOf("Vegetation", "2027-07-12", NOW)).toThrow(/future/);
  });
});
