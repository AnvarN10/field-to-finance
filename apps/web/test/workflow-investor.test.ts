import { describe, expect, it } from "vitest";
import { acceptKfd, acknowledgeRisk, investorOnboarding, kfdGate, linkWallet, saveQuestionnaire, submitInvestorKyc } from "../src/lib/workflow/investor";
import { decideInvestorKyc } from "../src/lib/workflow/arranger";
import { testDb } from "./helpers/db";
import { fakeChain, INVESTOR_WALLET, makeUser } from "./helpers/workflow";

const P1 = "Poo1A111111111111111111111111111111111111";
const P2 = "Poo1B111111111111111111111111111111111111";
const Q = { category: "professional", netAssets: "1m-10m", experience: "extensive", basis: "Licensed fund manager" } as const;

async function setup() {
  const db = await testDb();
  const investor = await makeUser(db, "demo+investor@example.com", ["investor"]);
  const ops = await makeUser(db, "ops@example.com", ["arranger"]);
  return { db, investor, ops };
}

describe("investor onboarding", () => {
  it("walks questionnaire, KYC, risk acknowledgement and wallet to complete", async () => {
    const { db, investor, ops } = await setup();
    expect((await investorOnboarding(db, investor.id)).complete).toBe(false);
    await expect(submitInvestorKyc(db, investor, { fullName: "Demo Investor", country: "Kazakhstan" })).rejects.toThrow(/questionnaire/);
    await saveQuestionnaire(db, investor, Q);
    await submitInvestorKyc(db, investor, { fullName: "Demo Investor", country: "Kazakhstan" });
    await acknowledgeRisk(db, investor);
    await linkWallet(db, investor, { address: INVESTOR_WALLET, kind: "phantom" });
    const chain = fakeChain();
    await decideInvestorKyc(db, ops, investor.id, "approved", null, chain);
    expect(chain.calls).toContain(`approveKyc:${INVESTOR_WALLET}`);
    const o = await investorOnboarding(db, investor.id);
    expect(o).toMatchObject({ category: "professional", kycStatus: "approved", riskAcknowledged: true, complete: true });
  });

  it("shows retail limits only for retail investors", async () => {
    const { db, investor } = await setup();
    await saveQuestionnaire(db, investor, { ...Q, category: "retail", basis: undefined });
    expect((await investorOnboarding(db, investor.id)).retailLimits).toMatch(/fewer than 50 retail investors/);
  });

  it("refuses a wallet already linked to another account", async () => {
    const { db, investor } = await setup();
    const other = await makeUser(db, "other@example.com", ["investor"]);
    await linkWallet(db, other, { address: INVESTOR_WALLET, kind: "phantom" });
    await expect(linkWallet(db, investor, { address: INVESTOR_WALLET, kind: "phantom" })).rejects.toMatchObject({ status: 409, message: "This wallet is linked to another account." });
  });

  it("approves a wallet on-chain when it is linked after KYC approval", async () => {
    const { db, investor, ops } = await setup();
    await saveQuestionnaire(db, investor, Q);
    await submitInvestorKyc(db, investor, { fullName: "Demo Investor", country: "Kazakhstan" });
    const chain = fakeChain();
    await decideInvestorKyc(db, ops, investor.id, "approved", null, chain);
    expect(chain.calls).toEqual([]);
    await linkWallet(db, investor, { address: INVESTOR_WALLET, kind: "phantom" }, chain);
    expect(chain.calls).toEqual([`approveKyc:${INVESTOR_WALLET}`]);
  });
});

describe("KFD gate", () => {
  it("returns unlinked, onboarding, kfd, then clears after acceptance", async () => {
    const { db, investor, ops } = await setup();
    expect(await kfdGate(db, INVESTOR_WALLET, P1)).toBe("unlinked");
    await linkWallet(db, investor, { address: INVESTOR_WALLET, kind: "phantom" });
    expect(await kfdGate(db, INVESTOR_WALLET, P1)).toBe("onboarding");
    await expect(acceptKfd(db, investor, P1, "a".repeat(64))).rejects.toMatchObject({ status: 409 });
    await saveQuestionnaire(db, investor, Q);
    await submitInvestorKyc(db, investor, { fullName: "Demo Investor", country: "Kazakhstan" });
    await decideInvestorKyc(db, ops, investor.id, "approved", null, fakeChain());
    await acknowledgeRisk(db, investor);
    expect(await kfdGate(db, INVESTOR_WALLET, P1)).toBe("kfd");
    await acceptKfd(db, investor, P1, "a".repeat(64));
    expect(await kfdGate(db, INVESTOR_WALLET, P1)).toBeNull();
    expect(await kfdGate(db, INVESTOR_WALLET, P2)).toBe("kfd");
  });
});
