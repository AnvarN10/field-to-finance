import { describe, expect, it } from "vitest";
import { auditLog, documents } from "../src/lib/db/schema";
import {
  addApplicationDocument,
  attachProject,
  createApplication,
  farmerChecklist,
  getOwnApplication,
  saveFarmerProfile,
  submitApplication,
  submitFarmerKyc,
  withdrawApplication,
} from "../src/lib/workflow/farmer";
import { REQUIRED_KINDS } from "../src/lib/workflow/documents";
import { testDb } from "./helpers/db";
import { doc, FARMER_WALLET, makeUser, PROJECT } from "./helpers/workflow";

export const APP_INPUT = { crop: "wheat", grade: "3", volumeT: 10000, tokenizedShareBps: 3000, requestedUsd: 200000, proposedCouponBps: 1200, season: 2027, elevator: "Demo elevator", lab: "Demo lab" };
const PROFILE = { legalName: "Demo Farm LLP", bin: "000000000000", region: "Demo region", contact: "demo+farmer@example.com" };

async function setup() {
  const db = await testDb();
  const farmer = await makeUser(db, "demo+farmer@example.com", ["farmer"], FARMER_WALLET);
  return { db, farmer };
}

describe("farmer workflow", () => {
  it("validates the profile: BIN is 12 digits", async () => {
    const { db, farmer } = await setup();
    await expect(saveFarmerProfile(db, farmer, { ...PROFILE, bin: "123" })).rejects.toMatchObject({ status: 400 });
    await saveFarmerProfile(db, farmer, PROFILE);
  });

  it("puts issuer KYC in pending after a document upload, and needs the profile first", async () => {
    const { db, farmer } = await setup();
    await expect(submitFarmerKyc(db, farmer, doc(1))).rejects.toMatchObject({ status: 409 });
    await saveFarmerProfile(db, farmer, PROFILE);
    expect((await submitFarmerKyc(db, farmer, doc(1))).kycStatus).toBe("pending");
  });

  it("refuses a farmer workflow call from a user without the farmer role", async () => {
    const { db } = await setup();
    const inv = await makeUser(db, "inv@example.com", ["investor"]);
    await expect(createApplication(db, inv, APP_INPUT)).rejects.toMatchObject({ status: 403 });
  });

  it("validates the application against program limits", async () => {
    const { db, farmer } = await setup();
    await expect(createApplication(db, farmer, { ...APP_INPUT, tokenizedShareBps: 3001 })).rejects.toMatchObject({ status: 400 });
    await expect(createApplication(db, farmer, { ...APP_INPUT, elevator: "x".repeat(33) })).rejects.toMatchObject({ status: 400 });
  });

  it("submits only with profile, every required document and registered fields", async () => {
    const { db, farmer } = await setup();
    const app = await createApplication(db, farmer, APP_INPUT);
    await expect(submitApplication(db, farmer, app.id)).rejects.toThrow(/company profile/);
    await saveFarmerProfile(db, farmer, PROFILE);
    await expect(submitApplication(db, farmer, app.id)).rejects.toThrow(/Upload/);
    for (const [i, kind] of REQUIRED_KINDS.entries()) await addApplicationDocument(db, farmer, app.id, kind, doc(i + 10));
    await expect(submitApplication(db, farmer, app.id)).rejects.toThrow(/fields/);
    await expect(attachProject(db, farmer, app.id, PROJECT, "SomeoneE1se111111111111111111111111111111")).rejects.toMatchObject({ status: 403 });
    await attachProject(db, farmer, app.id, PROJECT, FARMER_WALLET);
    expect((await submitApplication(db, farmer, app.id)).status).toBe("submitted");
    expect((await db.select().from(auditLog)).map((a) => a.action)).toContain("application.submit");
  });

  it("keeps a replaced upload as history and shows the newest in the checklist", async () => {
    const { db, farmer } = await setup();
    const app = await createApplication(db, farmer, APP_INPUT);
    await addApplicationDocument(db, farmer, app.id, "insurance", doc(1));
    await addApplicationDocument(db, farmer, app.id, "insurance", doc(2));
    expect(await db.select().from(documents)).toHaveLength(2);
    const row = (await farmerChecklist(db, app.id)).find((r) => r.kind === "insurance");
    expect(row).toMatchObject({ status: "pending", sha256: doc(2).sha256 });
    expect((await farmerChecklist(db, app.id)).find((r) => r.kind === "yields")?.status).toBe("missing");
  });

  it("after submission accepts a new upload only for a rejected document", async () => {
    const { db, farmer } = await setup();
    const app = await createApplication(db, farmer, APP_INPUT);
    await saveFarmerProfile(db, farmer, PROFILE);
    for (const [i, kind] of REQUIRED_KINDS.entries()) await addApplicationDocument(db, farmer, app.id, kind, doc(i + 10));
    await attachProject(db, farmer, app.id, PROJECT, FARMER_WALLET);
    await submitApplication(db, farmer, app.id);
    await expect(addApplicationDocument(db, farmer, app.id, "insurance", doc(99))).rejects.toMatchObject({ status: 409 });
  });

  it("hides another farmer's application (404) and refuses a malformed id", async () => {
    const { db, farmer } = await setup();
    const app = await createApplication(db, farmer, APP_INPUT);
    const other = await makeUser(db, "other@example.com", ["farmer"]);
    await expect(getOwnApplication(db, other, app.id)).rejects.toMatchObject({ status: 404 });
    await expect(getOwnApplication(db, farmer, "not-a-uuid")).rejects.toMatchObject({ status: 404 });
  });

  it("withdraws before open", async () => {
    const { db, farmer } = await setup();
    const app = await createApplication(db, farmer, APP_INPUT);
    expect((await withdrawApplication(db, farmer, app.id)).status).toBe("withdrawn");
    await expect(withdrawApplication(db, farmer, app.id)).rejects.toMatchObject({ status: 409 });
  });
});
