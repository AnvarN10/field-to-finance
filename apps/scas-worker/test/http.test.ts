import { sha256, toHex } from "@f2f/sdk";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import type { AttestRequest, AttestResult } from "../src/attest";
import { RequestError, SentinelError } from "../src/errors";
import { evidenceKey } from "../src/evidence";
import { createApp, tokenMatches, type HttpDeps } from "../src/http";
import { MemoryStore } from "../src/store";

const TOKEN = "k".repeat(40);
const PROJECT = Keypair.generate().publicKey.toBase58();
const RESULT = { verdict: "Pass", evidenceHash: "ab".repeat(32) } as unknown as AttestResult;

function setup(over: Partial<HttpDeps> = {}) {
  const store = new MemoryStore();
  const deps: HttpDeps = {
    attest: vi.fn(async (_req: AttestRequest) => RESULT),
    putPolygon: vi.fn(async () => ({ polygonHash: "cd".repeat(32), areaHa: 76.11, areaHaX100: 7611, key: "polygons/x.json" })),
    store,
    apiToken: TOKEN,
    scas: Keypair.generate().publicKey,
    version: "test",
    reportError: vi.fn(),
    ...over,
  };
  return { app: createApp(deps), deps, store };
}

const post = (body: unknown, token: string | null = TOKEN) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

describe("tokenMatches", () => {
  it("compares bearer tokens", () => {
    expect(tokenMatches(TOKEN, `Bearer ${TOKEN}`)).toBe(true);
    expect(tokenMatches(TOKEN, `Bearer ${TOKEN}x`)).toBe(false);
    expect(tokenMatches(TOKEN, TOKEN)).toBe(false);
    expect(tokenMatches(TOKEN, undefined)).toBe(false);
  });
});

describe("HTTP app", () => {
  it("serves health without auth", async () => {
    const { app } = setup();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, version: "test" });
  });

  it("rejects /attest without a valid token", async () => {
    const { app, deps } = setup();
    expect((await app.request("/attest", post({}, null))).status).toBe(401);
    expect((await app.request("/attest", post({}, "wrong"))).status).toBe(401);
    expect(deps.attest).not.toHaveBeenCalled();
  });

  it("validates the body and the kind", async () => {
    const { app } = setup();
    expect((await app.request("/attest", post({ project: PROJECT, fieldIndex: 300, kind: "Vegetation" }))).status).toBe(400);
    expect((await app.request("/attest", post({ project: "nope", fieldIndex: 0, kind: "Vegetation" }))).status).toBe(400);
    expect((await app.request("/attest", post({ project: PROJECT, fieldIndex: 0, kind: "rain" }))).status).toBe(400);
  });

  it("passes a parsed request to the orchestrator", async () => {
    const { app, deps } = setup();
    const res = await app.request("/attest", post({ project: PROJECT, fieldIndex: 1, kind: "vegetation", replayDate: "2026-07-12" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESULT);
    const req = vi.mocked(deps.attest).mock.calls[0]?.[0];
    expect(req?.project.toBase58()).toBe(PROJECT);
    expect(req).toMatchObject({ fieldIndex: 1, kind: "Vegetation", replayDate: "2026-07-12" });
  });

  it("maps RequestError to its status and SentinelError to 502", async () => {
    const conflict = setup({ attest: async () => { throw new RequestError("hash mismatch", 409); } });
    expect((await conflict.app.request("/attest", post({ project: PROJECT, fieldIndex: 0, kind: "FieldVerified" }))).status).toBe(409);

    const down = setup({ attest: async () => { throw new SentinelError("Statistical API returned 503", { retryable: true }); } });
    const res = await down.app.request("/attest", post({ project: PROJECT, fieldIndex: 0, kind: "FieldVerified" }));
    expect(res.status).toBe(502);
    expect(down.deps.reportError).toHaveBeenCalled();
  });

  it("hides unexpected errors behind 500 and reports them", async () => {
    const { app, deps } = setup({ attest: async () => { throw new Error("rpc exploded"); } });
    const res = await app.request("/attest", post({ project: PROJECT, fieldIndex: 0, kind: "FieldVerified" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal error" });
    expect(deps.reportError).toHaveBeenCalled();
  });

  it("uploads polygons behind auth", async () => {
    const { app, deps } = setup();
    expect((await app.request("/polygons", post({ type: "Polygon" }, null))).status).toBe(401);
    const res = await app.request("/polygons", post({ type: "Polygon" }));
    expect(res.status).toBe(200);
    expect(deps.putPolygon).toHaveBeenCalledWith({ type: "Polygon" });
  });

  it("serves evidence by hash and checks it", async () => {
    const { app, store } = setup();
    const bytes = new TextEncoder().encode('{"a":1}');
    const hash = toHex(sha256(bytes));
    await store.put(evidenceKey(hash), bytes, "application/json");

    const ok = await app.request(`/e/${hash}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("application/json");
    expect(await ok.text()).toBe('{"a":1}');

    expect((await app.request(`/e/${"0".repeat(64)}`)).status).toBe(404);
    expect((await app.request("/e/not-a-hash")).status).toBe(400);

    await store.put(evidenceKey("1".repeat(64)), bytes, "application/json");
    expect((await app.request(`/e/${"1".repeat(64)}`)).status).toBe(502);
  });
});
