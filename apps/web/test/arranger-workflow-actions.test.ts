import { describe, expect, it, vi } from "vitest";
import { investorProfiles } from "../src/lib/db/schema";
import { RequestError } from "../src/lib/errors";
import { testDb } from "./helpers/db";
import { fakeChain, INVESTOR_WALLET, makeUser } from "./helpers/workflow";

const db = await testDb();
const ops = await makeUser(db, "ops@example.com", ["arranger"]);
const inv = await makeUser(db, "inv@example.com", ["investor"], INVESTOR_WALLET);
await db.insert(investorProfiles).values({ userId: inv.id, category: "retail", kycStatus: "pending" });
let actor: unknown = ops;
const chain = fakeChain();
vi.mock("@/lib/server/auth", async () => (await import("./helpers/auth-mock")).guardsFor(() => actor as never));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/chain-port", () => ({ arrangerChain: () => chain }));
vi.mock("@/lib/server/context", () => ({ invalidateReads: () => {} }));
const actions = await import("../src/app/console/_actions/applications");

describe("application actions", () => {
  it("refuse a signed-out caller", async () => {
    actor = null;
    expect(await actions.rejectAction("00000000-0000-4000-8000-000000000000", "no")).toMatchObject({ ok: false, error: { title: "Your session expired. Sign in again." } });
    actor = ops;
  });
});
