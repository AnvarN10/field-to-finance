import { describe, expect, it } from "vitest";
import { applications, auditLog, farmerProfiles, investorProfiles, notifications, wallets } from "../src/lib/db/schema";
import {
  advanceApplication,
  applicationDetail,
  decideFarmerKyc,
  pipeline,
  publishApplication,
  refreshChainStatuses,
  rejectApplication,
  reviewDocument,
  structureApplication,
  verifyApplicationFields,
} from "../src/lib/workflow/arranger";
import { REQUIRED_KINDS } from "../src/lib/workflow/documents";
import { addApplicationDocument, attachProject, createApplication, saveFarmerProfile, submitApplication, submitFarmerKyc } from "../src/lib/workflow/farmer";
import { testDb } from "./helpers/db";
import { doc, fakeChain, FARMER_WALLET, makeUser, project, PROJECT } from "./helpers/workflow";

const APP = { crop: "wheat", grade: "3", volumeT: 10000, tokenizedShareBps: 3000, requestedUsd: 200000, proposedCouponBps: 1200, season: 2027, elevator: "Demo elevator", lab: "Demo lab" };
const TERMS = { name: "Demo wheat 2027", symbol: "DWHT27", unitNominalUsd: 100000, couponBps: 1200, settlementMode: "Hybrid", closeInMinutes: 60, maturityInMinutes: 600, arrangementFeeBps: 200 } as const;

async function submitted() {
  const db = await testDb();
  const ops = await makeUser(db, "ops@example.com", ["arranger"]);
  const farmer = await makeUser(db, "demo+farmer@example.com", ["farmer"], FARMER_WALLET);
  await saveFarmerProfile(db, farmer, { legalName: "Demo Farm LLP", bin: "000000000000", region: "Demo region", contact: "demo" });
  await submitFarmerKyc(db, farmer, doc(1));
  const app = await createApplication(db, farmer, APP);
  for (const [i, kind] of REQUIRED_KINDS.entries()) await addApplicationDocument(db, farmer, app.id, kind, doc(i + 10));
  await attachProject(db, farmer, app.id, PROJECT, FARMER_WALLET);
  await submitApplication(db, farmer, app.id);
  return { db, ops, farmer, app };
}

describe("arranger pipeline", () => {
  it("walks an application from submitted to open with gates, chain calls and audit", async () => {
    const { db, ops, farmer, app } = await submitted();
    const chain = fakeChain();
    await advanceApplication(db, ops, app.id, "documents_review", chain);
    await expect(advanceApplication(db, ops, app.id, "kyc", chain)).rejects.toThrow(/Accept every required document/);
    const detail = await applicationDetail(db, app.id);
    for (const d of detail.checklist) await reviewDocument(db, ops, d.documentId as string, "accepted", null);
    await advanceApplication(db, ops, app.id, "kyc", chain);
    await expect(advanceApplication(db, ops, app.id, "field_verification", chain)).rejects.toThrow(/KYC/);
    await decideFarmerKyc(db, ops, farmer.id, "approved", null, chain);
    await advanceApplication(db, ops, app.id, "field_verification", chain);
    await expect(advanceApplication(db, ops, app.id, "structuring", chain)).rejects.toThrow(/Verify every field/);
    await verifyApplicationFields(db, ops, app.id, chain);
    await advanceApplication(db, ops, app.id, "structuring", chain);
    await expect(advanceApplication(db, ops, app.id, "ready", chain)).rejects.toThrow(/Create the pool/);
    await structureApplication(db, ops, app.id, TERMS, chain);
    expect((await applicationDetail(db, app.id)).application).toMatchObject({ status: "ready", poolId: "9", poolAddress: "Pool9" });
    await expect(advanceApplication(db, ops, app.id, "open", chain)).rejects.toThrow(/Publish/);
    await publishApplication(db, ops, app.id, chain);
    expect((await applicationDetail(db, app.id)).application.status).toBe("open");
    expect(chain.calls).toEqual([
      `approveKyc:${FARMER_WALLET}`,
      `project:${PROJECT}`,
      `project:${PROJECT}`,
      `verifyFields:${PROJECT}`,
      `project:${PROJECT}`,
      `project:${PROJECT}`,
      `createTermPool:9:${FARMER_WALLET}`,
      `addProject:9:${PROJECT}`,
      "openPool:9",
    ]);
    const actions = (await db.select().from(auditLog)).map((a) => a.action);
    for (const a of ["document.accept", "farmer_kyc.approve", "fields.verify", "pool.create", "pool.add_project", "pool.open"]) expect(actions).toContain(a);
    const kyc = (await db.select().from(auditLog)).find((a) => a.action === "farmer_kyc.approve");
    expect(kyc?.txSignature).toBe(`sig-kyc-${FARMER_WALLET.slice(0, 4)}`);
    expect((await db.select().from(notifications)).length).toBeGreaterThan(0);
    const farmerTitles = (await db.select().from(notifications)).filter((n) => n.userId === farmer.id).map((n) => n.title);
    expect(farmerTitles).toContain("Document accepted");
    expect(kyc?.actingRole).toBe("compliance");
    expect((await db.select().from(auditLog)).find((a) => a.action === "fields.verify")?.actingRole).toBe("scas");
  });

  it("publishing a pool tells every approved investor", async () => {
    const { db, ops, farmer, app } = await submitted();
    const investor = await makeUser(db, "inv@example.com", ["investor"]);
    await db.insert(investorProfiles).values({ userId: investor.id, kycStatus: "approved" });
    const chain = fakeChain();
    await advanceApplication(db, ops, app.id, "documents_review", chain);
    for (const d of (await applicationDetail(db, app.id)).checklist) await reviewDocument(db, ops, d.documentId as string, "accepted", null);
    await advanceApplication(db, ops, app.id, "kyc", chain);
    await decideFarmerKyc(db, ops, farmer.id, "approved", null, chain);
    await advanceApplication(db, ops, app.id, "field_verification", chain);
    await verifyApplicationFields(db, ops, app.id, chain);
    await advanceApplication(db, ops, app.id, "structuring", chain);
    await structureApplication(db, ops, app.id, TERMS, chain);
    await publishApplication(db, ops, app.id, chain);
    const mine = (await db.select().from(notifications)).filter((n) => n.userId === investor.id);
    expect(mine).toEqual([expect.objectContaining({ kind: "pool", title: "New pool open: wheat 2027", link: "/investor/pools/9" })]);
  });

  it("requires a note to reject a document and notifies the farmer", async () => {
    const { db, ops, app } = await submitted();
    await advanceApplication(db, ops, app.id, "documents_review", fakeChain());
    const [first] = (await applicationDetail(db, app.id)).checklist;
    await expect(reviewDocument(db, ops, first!.documentId as string, "rejected", null)).rejects.toMatchObject({ status: 400 });
    await reviewDocument(db, ops, first!.documentId as string, "rejected", "The insurance policy has expired");
    expect((await applicationDetail(db, app.id)).checklist[0]?.status).toBe("rejected");
  });

  it("records a failed chain action in the audit log with the error and no signature", async () => {
    const { db, ops, farmer } = await submitted();
    const chain = fakeChain({ approveKyc: async () => { throw new Error("compliance key has no SOL"); } });
    await expect(decideFarmerKyc(db, ops, farmer.id, "approved", null, chain)).rejects.toThrow(/no SOL/);
    const row = (await db.select().from(auditLog)).find((a) => a.action === "farmer_kyc.approve");
    expect(row).toMatchObject({ txSignature: null, payload: expect.objectContaining({ error: "compliance key has no SOL" }) });
  });

  it("structuring refuses a nominal that does not divide the requested amount", async () => {
    const { db, ops, app } = await submitted();
    await db.update((await import("../src/lib/db/schema")).applications).set({ status: "structuring" });
    await expect(structureApplication(db, ops, app.id, { ...TERMS, unitNominalUsd: 70000 }, fakeChain())).rejects.toThrow(/divide/);
  });

  it("rejects with a reason, then nothing moves", async () => {
    const { db, ops, app } = await submitted();
    await rejectApplication(db, ops, app.id, "Fields outside the region");
    await expect(advanceApplication(db, ops, app.id, "documents_review", fakeChain())).rejects.toMatchObject({ status: 409 });
  });

  it("derives and caches statuses from the chain from open onwards", async () => {
    const { db, ops, app } = await submitted();
    const { applications } = await import("../src/lib/db/schema");
    await db.update(applications).set({ status: "open", poolId: "9", poolAddress: "Pool9" });
    const chain = fakeChain({
      pool: async () => ({ pool: { status: "Funded", maturityTs: 4_000_000_000, projectCount: 1, disbursedCount: 1, instrument: { supply: "2" } }, projects: [{ disbursed: true, harvestAttested: false, fields: [{ attestationCount: 1 }] }] }) as never,
    });
    expect(await refreshChainStatuses(db, chain, 1_000)).toBe(1);
    expect((await pipeline(db)).find((a) => a.id === app.id)?.status).toBe("disbursed");
    void ops;
  });

  it("binds issuer KYC to the issuer wallet: approval records it, structuring refuses a project from another wallet", async () => {
    const { db, ops, farmer, app } = await submitted();
    const chain = fakeChain();
    await decideFarmerKyc(db, ops, farmer.id, "approved", null, chain);
    expect((await db.select().from(farmerProfiles))[0]?.kycWallet).toBe(FARMER_WALLET);
    await db.update(applications).set({ status: "structuring" });
    const other = fakeChain({ project: async () => project({ producer: "0ther1111111111111111111111111111111111111" }) });
    await expect(structureApplication(db, ops, app.id, TERMS, other)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/issuer KYC approved/) });
  });

  it("structuring refuses before issuer KYC is approved", async () => {
    const { db, ops, app } = await submitted();
    await db.update(applications).set({ status: "structuring" });
    await expect(structureApplication(db, ops, app.id, TERMS, fakeChain())).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/issuer KYC/) });
  });

  it("attaching a project registered by the farmer's linked Phantom wallet is refused: only the issuer wallet may", async () => {
    const db = await testDb();
    const farmer = await makeUser(db, "f2@example.com", ["farmer"], FARMER_WALLET);
    const phantom = "PhantomWa11et11111111111111111111111111111";
    await db.insert(wallets).values({ address: phantom, userId: farmer.id, kind: "phantom" });
    const app = await createApplication(db, farmer, APP);
    await expect(attachProject(db, farmer, app.id, PROJECT, phantom)).rejects.toMatchObject({ status: 403, message: expect.stringContaining(FARMER_WALLET) });
    await attachProject(db, farmer, app.id, PROJECT, FARMER_WALLET);
  });
});
