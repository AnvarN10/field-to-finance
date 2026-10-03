import { sha256, toHex } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import { MemoryStore, evidenceKey, polygonKey, readHashed, serveHashed } from "../src/lib/store";

const enc = (s: string) => new TextEncoder().encode(s);

describe("store", () => {
  it("lays out keys like the stopped worker did", () => {
    expect(polygonKey("ab".repeat(32))).toBe(`polygons/${"ab".repeat(32)}.json`);
    expect(evidenceKey("cd".repeat(32))).toBe(`evidence/${"cd".repeat(32)}.json`);
  });

  it("returns stored bytes only when their sha256 matches", async () => {
    const store = new MemoryStore();
    const body = enc('{"a":1}');
    const hash = toHex(sha256(body));
    await store.put(evidenceKey(hash), body, "application/json");
    expect(await readHashed(store, evidenceKey(hash), hash)).toEqual(body);
    expect(await readHashed(store, evidenceKey("00".repeat(32)), "00".repeat(32))).toBeNull();
    await store.put(evidenceKey("11".repeat(32)), body, "application/json");
    await expect(readHashed(store, evidenceKey("11".repeat(32)), "11".repeat(32))).rejects.toMatchObject({ status: 502 });
  });

  it("serves JSON with an immutable cache header, 400 on a bad hash, 404 when missing", async () => {
    const store = new MemoryStore();
    const body = enc('{"b":2}');
    const hash = toHex(sha256(body));
    await store.put(polygonKey(hash), body, "application/json");
    const ok = await serveHashed(store, polygonKey(hash), hash);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toContain("immutable");
    expect(await ok.text()).toBe('{"b":2}');
    expect((await serveHashed(store, polygonKey("x"), "x")).status).toBe(400);
    expect((await serveHashed(store, polygonKey("22".repeat(32)), "22".repeat(32))).status).toBe(404);
  });
});
