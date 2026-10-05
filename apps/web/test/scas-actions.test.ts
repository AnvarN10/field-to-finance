import { describe, expect, it, vi } from "vitest";
import { RequestError } from "../src/lib/errors";
import { MemoryStore } from "../src/lib/store";
import { assertServiceRole } from "../src/lib/workflow/guards";
import { testDb } from "./helpers/db";
import { poolDetail } from "./helpers/pool";
import { fakeChain, makeUser } from "./helpers/workflow";

const db = await testDb();
const scas = await makeUser(db, "scas@example.com", ["scas"]);
const elevator = await makeUser(db, "el@example.com", ["elevator"]);
const store = new MemoryStore();
let actor: unknown = scas;
const chain = fakeChain({ pool: async () => poolDetail() });
vi.mock("@/lib/server/auth", () => ({
  requireServiceAction: async (role: "scas") => {
    if (!actor) throw new RequestError("Your session expired. Sign in again.", 401);
    return assertServiceRole(actor as never, role);
  },
}));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/chain-port", () => ({ arrangerChain: () => chain }));
vi.mock("@/lib/server/context", () => ({ invalidateReads: () => {}, getStore: () => store }));
const actions = await import("../src/app/scas/actions");

const form = (fields: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("SCAS actions", () => {
  it("refuse a signed-out caller and an elevator user", async () => {
    actor = null;
    expect(await actions.attestAction("9", form({ kind: "Sowing" }))).toMatchObject({ ok: false, error: { title: "Your session expired. Sign in again." } });
    actor = elevator;
    expect(await actions.attestAction("9", form({ kind: "Sowing" }))).toMatchObject({ ok: false, error: { title: "Your account does not have the scas role." } });
    expect(chain.calls).toEqual([]);
  });

  it("store the evidence file first, then attest", async () => {
    actor = scas;
    const file = new File([new TextEncoder().encode("%PDF-1.4 field visit")], "visit.pdf", { type: "application/pdf" });
    const r = await actions.attestAction("9", form({ kind: "Harvest", note: "Grain filling", yield: "3.2", file }));
    expect(r).toMatchObject({ ok: true, signatures: ["sig-attest-Harvest"] });
    expect([...store.objects.keys()].some((k) => k.startsWith("documents/"))).toBe(true);
  });

  it("explain a bad yield value", async () => {
    expect(await actions.attestAction("9", form({ kind: "Harvest", yield: "lots" }))).toMatchObject({ ok: false, error: { title: expect.stringMatching(/yield estimate/) } });
  });
});
