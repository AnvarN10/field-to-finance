import { PILOT_QUALITY_SPEC } from "@f2f/sdk";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { applications, auditLog, notifications } from "../src/lib/db/schema";
import type { DeliveryEvidence } from "../src/lib/pilot-docs";
import { createApplication, saveFarmerProfile } from "../src/lib/workflow/farmer";
import { recordElevatorReceipt, recordLabProtocol } from "../src/lib/workflow/delivery";
import { testDb } from "./helpers/db";
import { POOL_ADDRESS, poolDetail } from "./helpers/pool";
import { fakeChain, FARMER_WALLET, makeUser } from "./helpers/workflow";

const good = { crop: "Wheat", class: "HiPro (class 3)", gluten: "31", protein: "15.2", moisture: "13.5", falling_number: "250", test_weight: "760", impurities: "1.5", odour: "None", gluten_deformation_index: "70", vitreousness: "55", pests: "None" };
const receipt = { poolId: "9", tonnes: 950, receiptNumber: "RCPT-000-DEMO", receivedOn: "2027-08-20", documentSha256: "aa".repeat(32) };

async function setup(detail = poolDetail()) {
  const db = await testDb();
  const elevator = await makeUser(db, "el@example.com", ["elevator"]);
  const lab = await makeUser(db, "lab@example.com", ["lab"]);
  const ops = await makeUser(db, "ops@example.com", ["arranger"]);
  const farmer = await makeUser(db, "f@example.com", ["farmer"], FARMER_WALLET);
  await saveFarmerProfile(db, farmer, { legalName: "Demo Farm LLP", bin: "000000000000", region: "Demo", contact: "demo" });
  const app = await createApplication(db, farmer, { crop: "wheat", grade: "3", volumeT: 100, tokenizedShareBps: 3000, requestedUsd: 1000, proposedCouponBps: 1200, season: 2027, elevator: "Demo elevator", lab: "Demo lab" });
  await db.update(applications).set({ poolId: "9", poolAddress: POOL_ADDRESS }).where(eq(applications.id, app.id));
  const recorded: DeliveryEvidence[] = [];
  const chain = fakeChain({
    pool: async () => detail,
    recordDelivery: async (_poolId, e) => {
      recorded.push(e);
      return { signature: `sig-${e.kind}`, evidenceHash: "ee".repeat(32) };
    },
  });
  return { db, elevator, lab, ops, farmer, chain, recorded };
}

describe("elevator and laboratory", () => {
  it("the elevator records a receipt: tonnes, date, receipt number hashed, file hash; audited and notified", async () => {
    const { db, elevator, farmer, chain, recorded } = await setup();
    await recordElevatorReceipt(db, elevator, receipt, chain);
    expect(recorded[0]).toMatchObject({ kind: "ElevatorReceipt", verdict: "Pass", poolId: "9", kg: "950000", receivedOn: "2027-08-20", documentSha256: "aa".repeat(32) });
    expect(recorded[0]?.receiptNumberSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(recorded[0])).not.toContain("RCPT-000-DEMO");
    expect((await db.select().from(auditLog).where(eq(auditLog.action, "pool.record_delivery")))[0]).toMatchObject({ actingRole: "elevator", txSignature: "sig-ElevatorReceipt" });
    expect((await db.select().from(notifications).where(eq(notifications.userId, farmer.id))).map((n) => n.title)).toContain("Elevator receipt recorded: DWHT27");
  });

  it("the laboratory records a protocol; the verdict comes from the twelve parameters", async () => {
    const { db, lab, chain, recorded } = await setup();
    await recordLabProtocol(db, lab, { poolId: "9", measured: { ...good, protein: "14.0" }, documentSha256: "bb".repeat(32) }, chain, PILOT_QUALITY_SPEC);
    expect(recorded[0]).toMatchObject({ kind: "LabQuality", verdict: "Fail" });
    expect(recorded[0]?.results?.find((r) => r.key === "protein")).toMatchObject({ pass: false, measured: "14.0" });
    expect((await db.select().from(auditLog).where(eq(auditLog.action, "pool.record_delivery")))[0]?.actingRole).toBe("lab");
  });

  it("each role stays in its lane; an arranger can do both", async () => {
    const { db, lab, elevator, ops, chain, recorded } = await setup();
    await expect(recordElevatorReceipt(db, lab, receipt, chain)).rejects.toMatchObject({ status: 403 });
    await expect(recordLabProtocol(db, elevator, { poolId: "9", measured: good, documentSha256: "bb".repeat(32) }, chain, PILOT_QUALITY_SPEC)).rejects.toMatchObject({ status: 403 });
    expect(recorded).toEqual([]);
    await recordElevatorReceipt(db, ops, receipt, chain);
    await recordLabProtocol(db, ops, { poolId: "9", measured: good, documentSha256: "bb".repeat(32) }, chain, PILOT_QUALITY_SPEC);
    expect(recorded.map((r) => [r.kind, r.verdict])).toEqual([["ElevatorReceipt", "Pass"], ["LabQuality", "Pass"]]);
  });

  it("refuses an elected buyback", async () => {
    const elected = await setup(poolDetail({ terms: { election: "Buyback" } }));
    await expect(recordElevatorReceipt(elected.db, elected.elevator, receipt, elected.chain)).rejects.toMatchObject({ status: 409 });
  });

  it("refuses a cash-only pool", async () => {
    const cash = await setup(poolDetail({ terms: { settlementMode: "CashBuyback" } }));
    await expect(recordElevatorReceipt(cash.db, cash.elevator, receipt, cash.chain)).rejects.toMatchObject({ status: 409 });
  });

  it("refuses a pool that is not funded", async () => {
    const open = await setup(poolDetail({ pool: { status: "Open" } }));
    await expect(recordElevatorReceipt(open.db, open.elevator, receipt, open.chain)).rejects.toMatchObject({ status: 409 });
  });

  it("validates tonnes, the receipt number and the date", async () => {
    const { db, elevator, chain } = await setup();
    await expect(recordElevatorReceipt(db, elevator, { ...receipt, tonnes: 0 }, chain)).rejects.toMatchObject({ status: 400 });
    await expect(recordElevatorReceipt(db, elevator, { ...receipt, receiptNumber: " " }, chain)).rejects.toMatchObject({ status: 400 });
    await expect(recordElevatorReceipt(db, elevator, { ...receipt, receivedOn: "20/08/2027" }, chain)).rejects.toMatchObject({ status: 400 });
  });
});
