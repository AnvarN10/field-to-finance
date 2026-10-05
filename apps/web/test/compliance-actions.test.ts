import { describe, expect, it, vi } from "vitest";
import { investorProfiles } from "../src/lib/db/schema";
import { RequestError } from "../src/lib/errors";
import { assertServiceRole } from "../src/lib/workflow/guards";
import { testDb } from "./helpers/db";
import { fakeChain, INVESTOR_WALLET, makeUser } from "./helpers/workflow";

const db = await testDb();
const officer = await makeUser(db, "co@example.com", ["compliance"]);
const lab = await makeUser(db, "lab@example.com", ["lab"]);
const inv = await makeUser(db, "inv@example.com", ["investor"], INVESTOR_WALLET);
await db.insert(investorProfiles).values({ userId: inv.id, category: "retail", kycStatus: "pending" });
let actor: unknown = officer;
const chain = fakeChain();
vi.mock("@/lib/server/auth", () => ({
  requireServiceAction: async (role: "compliance") => {
    if (!actor) throw new RequestError("Your session expired. Sign in again.", 401);
    return assertServiceRole(actor as never, role);
  },
}));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/chain-port", () => ({ arrangerChain: () => chain }));
vi.mock("@/lib/server/context", () => ({ invalidateReads: () => {} }));
const actions = await import("../src/app/compliance/actions");

describe("compliance actions", () => {
  it("refuse a signed-out caller and a lab user; nothing goes on-chain", async () => {
    actor = null;
    expect(await actions.decideInvestorKycAction(inv.id, "approved", null)).toMatchObject({ ok: false, error: { title: "Your session expired. Sign in again." } });
    actor = lab;
    expect(await actions.decideInvestorKycAction(inv.id, "approved", null)).toMatchObject({ ok: false, error: { title: "Your account does not have the compliance role." } });
    expect(await actions.revokeInvestorKycAction(inv.id, "reason")).toMatchObject({ ok: false });
    expect(chain.calls).toEqual([]);
  });

  it("approve as compliance and return the signatures written during the action", async () => {
    actor = officer;
    expect(await actions.decideInvestorKycAction(inv.id, "approved", null)).toMatchObject({ ok: true, signatures: [`sig-kyc-${INVESTOR_WALLET.slice(0, 4)}`] });
  });

  it("revoke as compliance", async () => {
    expect(await actions.revokeInvestorKycAction(inv.id, "Sanctions screening hit")).toMatchObject({ ok: true, signatures: expect.arrayContaining([`sig-revoke-${INVESTOR_WALLET.slice(0, 4)}`]) });
  });
});
