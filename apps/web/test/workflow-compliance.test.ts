import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditLog, investorProfiles, notifications, wallets } from "../src/lib/db/schema";
import { decideInvestorKyc } from "../src/lib/workflow/arranger";
import { audit } from "../src/lib/workflow/audit";
import { complianceQueues, RETAIL_INVESTOR_LIMIT, retailMonitor, revokeInvestor } from "../src/lib/workflow/compliance";
import { saveQuestionnaire, submitInvestorKyc } from "../src/lib/workflow/investor";
import { testDb } from "./helpers/db";
import { fakeChain, INVESTOR_WALLET, makeUser } from "./helpers/workflow";

async function setup() {
  const db = await testDb();
  const ops = await makeUser(db, "ops@example.com", ["arranger"]);
  const officer = await makeUser(db, "co@example.com", ["compliance"]);
  const scas = await makeUser(db, "scas@example.com", ["scas"]);
  const inv = await makeUser(db, "inv@example.com", ["investor"], INVESTOR_WALLET);
  await saveQuestionnaire(db, inv, { category: "retail", netAssets: "100k-1m", experience: "some" });
  await submitInvestorKyc(db, inv, { fullName: "Demo Investor", country: "Other", iin: "000000000000" });
  return { db, ops, officer, scas, inv };
}

describe("compliance", () => {
  it("a compliance officer approves investor KYC on-chain; the audit row names the role", async () => {
    const { db, officer, inv } = await setup();
    const chain = fakeChain();
    expect((await complianceQueues(db)).investors.map((r) => r.email)).toEqual(["inv@example.com"]);
    await decideInvestorKyc(db, officer, inv.id, "approved", null, chain);
    expect(chain.calls).toEqual([`approveKyc:${INVESTOR_WALLET}`]);
    const [row] = await db.select().from(auditLog).where(eq(auditLog.action, "investor_kyc.approve"));
    expect(row).toMatchObject({ actorUserId: officer.id, actingRole: "compliance" });
    expect((await complianceQueues(db)).approvedInvestors.map((r) => r.email)).toEqual(["inv@example.com"]);
  });

  it("an arranger acting for compliance is audited as compliance", async () => {
    const { db, ops, inv } = await setup();
    await decideInvestorKyc(db, ops, inv.id, "rejected", "Name does not match", fakeChain());
    const [row] = await db.select().from(auditLog).where(eq(auditLog.action, "investor_kyc.reject"));
    expect(row).toMatchObject({ actorUserId: ops.id, actingRole: "compliance" });
  });

  it("a SCAS partner cannot decide KYC and nothing is sent", async () => {
    const { db, scas, inv } = await setup();
    const chain = fakeChain();
    await expect(decideInvestorKyc(db, scas, inv.id, "approved", null, chain)).rejects.toMatchObject({ status: 403 });
    expect(chain.calls).toEqual([]);
  });

  it("the IIN is optional, twelve digits, and kept in the questionnaire", async () => {
    const { db, inv } = await setup();
    const p = await db.query.investorProfiles.findFirst({ where: eq(investorProfiles.userId, inv.id) });
    expect((p?.questionnaire.kyc as { iin?: string }).iin).toBe("000000000000");
    await expect(submitInvestorKyc(db, inv, { fullName: "Demo Investor", country: "Other", iin: "123" })).rejects.toMatchObject({ status: 400 });
  });

  it("revocation revokes every linked wallet on-chain, marks the profile and notifies", async () => {
    const { db, officer, inv } = await setup();
    await db.insert(wallets).values({ address: "Phantom1111111111111111111111111111111111111", userId: inv.id, kind: "phantom" });
    const chain = fakeChain();
    await decideInvestorKyc(db, officer, inv.id, "approved", null, chain);
    await expect(revokeInvestor(db, officer, inv.id, "", chain)).rejects.toMatchObject({ status: 400 });
    await revokeInvestor(db, officer, inv.id, "Sanctions screening hit", chain);
    expect(chain.calls.filter((c) => c.startsWith("revokeKyc"))).toHaveLength(2);
    const p = await db.query.investorProfiles.findFirst({ where: eq(investorProfiles.userId, inv.id) });
    expect(p).toMatchObject({ kycStatus: "rejected", kycNote: "Revoked: Sanctions screening hit" });
    expect((await db.select().from(auditLog).where(eq(auditLog.action, "investor_kyc.revoke")))[0]?.actingRole).toBe("compliance");
    expect((await db.select().from(notifications).where(eq(notifications.userId, inv.id))).map((n) => n.title)).toContain("KYC revoked");
  });

  it("a scas user cannot revoke", async () => {
    const { db, scas, inv } = await setup();
    await expect(revokeInvestor(db, scas, inv.id, "reason here", fakeChain())).rejects.toMatchObject({ status: 403 });
  });

  it("retail monitor counts distinct retail subscribers per pool and flags amounts under the minimum", async () => {
    const { db, inv } = await setup();
    const pro = await makeUser(db, "pro@example.com", ["investor"]);
    await db.insert(investorProfiles).values({ userId: pro.id, category: "professional", kycStatus: "approved" });
    const sub = (userId: string, amount: bigint) => audit(db, { actorUserId: userId, action: "tx.subscribe", targetType: "wallet", targetId: "w", payload: { pool: "PoolA", amount: amount.toString() } });
    await sub(inv.id, 50_000_000_000n);
    await sub(inv.id, 30_000_000_000n);
    await sub(pro.id, 500_000_000_000n);
    const [m] = await retailMonitor(db, [{ address: "PoolA", poolId: "1", symbol: "F2F1" }]);
    expect(m).toMatchObject({ poolId: "1", retailInvestors: 1, limit: RETAIL_INVESTOR_LIMIT, retailTotal: 80_000_000_000n });
    expect(m?.investors).toEqual([expect.objectContaining({ email: "inv@example.com", amount: 80_000_000_000n, belowMinimum: true })]);
  });
});
