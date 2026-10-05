import { sha256, toHex } from "@f2f/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { documents } from "../../src/lib/db/schema";
import { documentKey } from "../../src/lib/pilot-docs";
import { MemoryStore } from "../../src/lib/store";
import { testDb } from "../helpers/db";
import { makeUser } from "../helpers/workflow";

const store = new MemoryStore();
const db = await testDb();
const owner = await makeUser(db, "farmer@example.com", ["farmer"]);
const other = await makeUser(db, "other@example.com", ["farmer"]);
const ops = await makeUser(db, "ops@example.com", ["arranger"]);
const officer = await makeUser(db, "co@example.com", ["compliance"]);
const regulator = await makeUser(db, "reg@example.com", ["regulator"]);
let user: unknown = null;
vi.mock("@/lib/server/context", () => ({ getStore: () => store }));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/auth", () => ({ currentUser: async () => user }));
const route = await import("../../src/app/api/documents/[hash]/route");

const bytes = new TextEncoder().encode("%PDF-1.7 receipt");
const hash = toHex(sha256(bytes));
await db.insert(documents).values({ ownerUserId: owner.id, kind: "insurance", sha256: hash, bucketKey: documentKey(hash), contentType: "application/pdf", size: bytes.length });
const get = (h = hash) => route.GET(new Request(`http://x/api/documents/${h}`), { params: Promise.resolve({ hash: h }) });

beforeEach(async () => {
  await store.put(documentKey(hash), bytes, "application/pdf");
});

describe("GET /api/documents/[hash]", () => {
  it("needs a session", async () => {
    user = null;
    expect((await get()).status).toBe(401);
  });

  it("serves the owner and any arranger, never cached", async () => {
    user = owner;
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    user = ops;
    expect((await get()).status).toBe(200);
  });

  it("answers 404 to another farmer, as if the document did not exist", async () => {
    user = other;
    expect((await get()).status).toBe(404);
  });

  it("serves compliance the issuer KYC documents only; other service roles get 404", async () => {
    const kycBytes = new TextEncoder().encode("%PDF-1.7 charter");
    const kycHash = toHex(sha256(kycBytes));
    await db.insert(documents).values({ ownerUserId: owner.id, kind: "kyc", sha256: kycHash, bucketKey: documentKey(kycHash), contentType: "application/pdf", size: kycBytes.length });
    await store.put(documentKey(kycHash), kycBytes, "application/pdf");
    user = officer;
    expect((await get(kycHash)).status).toBe(200);
    expect((await get()).status).toBe(404);
    user = regulator;
    expect((await get(kycHash)).status).toBe(404);
  });

  it("rejects a malformed hash", async () => {
    user = ops;
    expect((await get("ABC")).status).toBe(400);
  });
});
