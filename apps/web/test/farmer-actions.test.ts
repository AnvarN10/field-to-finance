import { describe, expect, it, vi } from "vitest";
import { applications, documents } from "../src/lib/db/schema";
import { RequestError } from "../src/lib/errors";
import { MemoryStore } from "../src/lib/store";
import { testDb } from "./helpers/db";
import { FARMER_WALLET, makeUser, project } from "./helpers/workflow";

const db = await testDb();
const store = new MemoryStore();
const farmer = await makeUser(db, "demo+farmer@example.com", ["farmer"], FARMER_WALLET);
let actor: unknown = farmer;
let onChainProducer = FARMER_WALLET;
vi.mock("@/lib/server/auth", () => ({
  requireActionRole: async () => {
    if (!actor) throw new RequestError("Your session expired. Sign in again.", 401);
    return actor;
  },
}));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/context", () => ({ getStore: () => store }));
vi.mock("@/lib/server/chain-port", () => ({ arrangerChain: () => ({ project: async (a: string) => project({ address: a, producer: onChainProducer }) }) }));
const actions = await import("../src/app/farmer/actions");

const APP = { crop: "wheat", grade: "3", volumeT: 1000, tokenizedShareBps: 3000, requestedUsd: 200000, proposedCouponBps: 1200, season: 2027, elevator: "Demo elevator", lab: "Demo lab" };
const pdf = () => {
  const f = new FormData();
  f.set("file", new File(["%PDF-1.7 demo"], "d.pdf", { type: "application/pdf" }));
  return f;
};

describe("farmer actions", () => {
  it("create an application and upload a document into the bucket and Postgres", async () => {
    const r = await actions.createApplicationAction(APP);
    expect(r.ok).toBe(true);
    const id = (r as { id: string }).id;
    expect(await actions.uploadDocumentAction(id, "insurance", pdf())).toEqual({ ok: true });
    const [d] = await db.select().from(documents);
    expect(await store.get(d!.bucketKey)).not.toBeNull();
  });

  it("refuse a file type the bucket does not accept, with the reason", async () => {
    const [a] = await db.select().from(applications);
    const f = new FormData();
    f.set("file", new File(["x"], "x.exe", { type: "application/x-msdownload" }));
    expect(await actions.uploadDocumentAction(a!.id, "yields", f)).toEqual({ ok: false, error: "Upload a PDF, image, CSV, XLSX, DOCX or ZIP file" });
  });

  it("attach a project only when the chain says the farmer's wallet registered it", async () => {
    const [a] = await db.select().from(applications);
    onChainProducer = "SomeoneE1se111111111111111111111111111111";
    expect(await actions.attachProjectAction(a!.id, "Proj1111111111111111111111111111111111111", [])).toMatchObject({ ok: false, error: "The project was registered by a wallet that is not yours." });
    onChainProducer = FARMER_WALLET;
    expect(await actions.attachProjectAction(a!.id, "Proj1111111111111111111111111111111111111", [{ polygonHash: "a".repeat(64), areaHaX100: 100, name: "Demo field", cadastralNumber: "00-000-000-000", declaredAreaHa: 1 }])).toEqual({ ok: true });
    const [row] = await db.select().from(applications);
    expect(row!.projectAddress).toBe("Proj1111111111111111111111111111111111111");
    expect(row!.fieldSetHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("answer a signed-out caller with the session message", async () => {
    actor = null;
    expect(await actions.createApplicationAction(APP)).toEqual({ ok: false, error: "Your session expired. Sign in again." });
    actor = farmer;
  });
});
