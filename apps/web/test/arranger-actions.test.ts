import { describe, expect, it, vi } from "vitest";
import { auditLog } from "../src/lib/db/schema";
import { RequestError } from "../src/lib/errors";
import { testDb } from "./helpers/db";
import { makeUser } from "./helpers/workflow";

const db = await testDb();
const ops = await makeUser(db, "ops@example.com", ["arranger"]);
let actor: unknown = null;
const openPool = vi.fn(async () => "sig-open-1");
vi.mock("@/lib/server/auth", () => ({
  requireActionRole: async () => {
    if (actor === "signed-out") throw new RequestError("Your session expired. Sign in again.", 401);
    if (actor === "investor") throw new RequestError("Your account does not have the arranger role.", 403);
    return actor;
  },
}));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/chain-port", () => ({ arrangerChain: () => ({ pool: async () => null }) }));
vi.mock("@/lib/chain/admin-ops", async (orig) => ({ ...(await orig<typeof import("../src/lib/chain/admin-ops")>()), openPool: (...a: unknown[]) => openPool(...(a as [])) }));
vi.mock("@/lib/server/context", () => ({ opsContext: () => ({}), invalidateReads: () => {}, getReader: () => ({}), getStore: () => ({}), stubDeps: () => ({}) }));
vi.mock("@/lib/server/env", () => ({ serverEnv: () => ({ PUBLIC_BASE_URL: "http://localhost:3000" }) }));
const actions = await import("../src/app/arranger/actions");

describe("arranger actions", () => {
  it("refuse a signed-out caller with a plain message and send nothing", async () => {
    actor = "signed-out";
    const r = await actions.openPoolAction("7");
    expect(r).toMatchObject({ ok: false, error: { title: "Your session expired. Sign in again." } });
    expect(openPool).not.toHaveBeenCalled();
  });

  it("refuse a user without the arranger role", async () => {
    actor = "investor";
    expect(await actions.openPoolAction("7")).toMatchObject({ ok: false, error: { title: "Your account does not have the arranger role." } });
    expect(openPool).not.toHaveBeenCalled();
  });

  it("run for an arranger and write the audit row with the signature", async () => {
    actor = ops;
    expect(await actions.openPoolAction("7")).toMatchObject({ ok: true, signatures: ["sig-open-1"] });
    const row = (await db.select().from(auditLog)).find((a) => a.action === "pool.open");
    expect(row).toMatchObject({ actorUserId: ops.id, targetType: "pool", targetId: "7", txSignature: "sig-open-1" });
  });

  it("record a failed on-chain attempt with its error", async () => {
    actor = ops;
    openPool.mockRejectedValueOnce(new Error("custom program error: 0x1771"));
    expect((await actions.openPoolAction("8")).ok).toBe(false);
    const row = (await db.select().from(auditLog)).find((a) => a.targetId === "8");
    expect(row).toMatchObject({ action: "pool.open", txSignature: null, payload: expect.objectContaining({ error: expect.stringContaining("0x1771") }) });
  });
});
