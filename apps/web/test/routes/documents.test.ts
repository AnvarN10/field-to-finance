import { sha256, toHex } from "@f2f/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE, adminToken } from "../../src/lib/admin-auth";
import { documentKey } from "../../src/lib/pilot-docs";
import { MemoryStore } from "../../src/lib/store";

const store = new MemoryStore();
vi.mock("@/lib/server/context", () => ({ getStore: () => store }));
vi.mock("@/lib/server/env", () => ({ serverEnv: () => ({ ADMIN_PASSWORD: "pw" }) }));
const route = await import("../../src/app/api/documents/[hash]/route");

const bytes = new TextEncoder().encode("%PDF-1.7 receipt");
const hash = toHex(sha256(bytes));
const get = (cookie?: string, h = hash) =>
  route.GET(new Request(`http://x/api/documents/${h}`, { headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ hash: h }) });

beforeEach(async () => {
  await store.put(documentKey(hash), bytes, "application/pdf");
});

describe("GET /api/documents/[hash]", () => {
  it("is for the admin console only: farmer documents are not shown to every basic-auth viewer", async () => {
    expect((await get()).status).toBe(401);
    expect((await get(`${ADMIN_COOKIE}=nope`)).status).toBe(401);
  });

  it("serves the stored bytes, hash-checked and never cached publicly", async () => {
    const res = await get(`other=1; ${ADMIN_COOKIE}=${adminToken("pw")}`);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).toBe("attachment");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("rejects malformed hashes and missing objects", async () => {
    const cookie = `${ADMIN_COOKIE}=${adminToken("pw")}`;
    expect((await get(cookie, "x")).status).toBe(400);
    expect((await get(cookie, "0".repeat(64))).status).toBe(404);
  });
});
