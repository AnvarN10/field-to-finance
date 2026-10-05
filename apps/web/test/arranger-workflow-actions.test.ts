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
vi.mock("@/lib/server/auth", () => ({
  requireActionRole: async () => {
    if (!actor) throw new RequestError("Your session expired. Sign in again.", 401);
    return actor;
  },
}));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/chain-port", () => ({ arrangerChain: () => chain }));
vi.mock("@/lib/server/context", () => ({ invalidateReads: () => {} }));
const actions = await import("../src/app/arranger/workflow-actions");

describe("arranger workflow actions", () => {
  it("refuse a signed-out caller", async () => {
    actor = null;
    expect(await actions.decideInvestorKycAction(inv.id, "approved", null)).toMatchObject({ ok: false, error: { title: "Your session expired. Sign in again." } });
    actor = ops;
  });

  it("approve investor KYC and return the on-chain signatures written during the action", async () => {
    const r = await actions.decideInvestorKycAction(inv.id, "approved", null);
    expect(r).toMatchObject({ ok: true, message: "Investor KYC approved", signatures: [`sig-kyc-${INVESTOR_WALLET.slice(0, 4)}`] });
  });

  it("grant a role by email and refuse revoking your own arranger role", async () => {
    expect(await actions.grantRoleAction("new@example.com", "farmer")).toMatchObject({ ok: true });
    expect(await actions.revokeRoleAction(ops.id, "arranger")).toMatchObject({ ok: false, error: { title: "You cannot remove your own arranger role." } });
  });
});
