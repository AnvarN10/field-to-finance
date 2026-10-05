import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { applications, auditLog, kfdAcceptances, notifications } from "../src/lib/db/schema";
import { createApplication, saveFarmerProfile } from "../src/lib/workflow/farmer";
import { recordSeasonAttestation, scasPools } from "../src/lib/workflow/scas";
import type { SeasonAttestInput } from "../src/lib/workflow/ports";
import { testDb } from "./helpers/db";
import { POOL_ADDRESS, poolDetail } from "./helpers/pool";
import { fakeChain, FARMER_WALLET, makeUser } from "./helpers/workflow";

async function setup(detail = poolDetail()) {
  const db = await testDb();
  const scas = await makeUser(db, "scas@example.com", ["scas"]);
  const ops = await makeUser(db, "ops@example.com", ["arranger"]);
  const lab = await makeUser(db, "lab@example.com", ["lab"]);
  const farmer = await makeUser(db, "f@example.com", ["farmer"], FARMER_WALLET);
  const inv = await makeUser(db, "i@example.com", ["investor"]);
  await saveFarmerProfile(db, farmer, { legalName: "Demo Farm LLP", bin: "000000000000", region: "Demo", contact: "demo" });
  const app = await createApplication(db, farmer, { crop: "wheat", grade: "3", volumeT: 100, tokenizedShareBps: 3000, requestedUsd: 1000, proposedCouponBps: 1200, season: 2027, elevator: "Demo elevator", lab: "Demo lab" });
  await db.update(applications).set({ poolId: "9", poolAddress: POOL_ADDRESS, status: "disbursed" }).where(eq(applications.id, app.id));
  await db.insert(kfdAcceptances).values({ investorUserId: inv.id, poolAddress: POOL_ADDRESS, documentHash: "0".repeat(64) });
  const attested: SeasonAttestInput[] = [];
  const chain = fakeChain({
    pool: async () => detail,
    attest: async (input) => {
      attested.push(input);
      return ["sig-attest-1"];
    },
  });
  return { db, scas, ops, lab, farmer, inv, chain, attested };
}

const veg: SeasonAttestInput = { poolId: "9", kind: "Vegetation", note: "Canopy closed", documentSha256: null, yieldEstimateTPerHa: null };

describe("SCAS partner", () => {
  it("records a season attestation, audits the role and tells the farmer and the investors", async () => {
    const { db, scas, farmer, inv, chain, attested } = await setup();
    expect(await recordSeasonAttestation(db, scas, veg, chain)).toEqual(["sig-attest-1"]);
    expect(attested).toEqual([veg]);
    const [row] = await db.select().from(auditLog).where(eq(auditLog.action, "pool.attest_stage"));
    expect(row).toMatchObject({ actorUserId: scas.id, actingRole: "scas", targetId: "9", txSignature: "sig-attest-1" });
    const titles = async (id: string) => (await db.select().from(notifications).where(eq(notifications.userId, id))).map((n) => n.title);
    expect(await titles(farmer.id)).toContain("Vegetation attested: DWHT27");
    expect(await titles(inv.id)).toContain("Vegetation attested: DWHT27");
  });

  it("the yield estimate is a Harvest attestation and needs the estimate", async () => {
    const { db, scas, chain } = await setup();
    await expect(recordSeasonAttestation(db, scas, { ...veg, kind: "Harvest" }, chain)).rejects.toMatchObject({ status: 400 });
    await expect(recordSeasonAttestation(db, scas, { ...veg, kind: "Harvest", yieldEstimateTPerHa: 99 }, chain)).rejects.toMatchObject({ status: 400 });
    expect(await recordSeasonAttestation(db, scas, { ...veg, kind: "Harvest", yieldEstimateTPerHa: 3.2 }, chain)).toEqual(["sig-attest-1"]);
  });

  it("refuses a pool that is not funded yet", async () => {
    const { db, scas, chain } = await setup(poolDetail({ pool: { status: "Open" } }));
    await expect(recordSeasonAttestation(db, scas, veg, chain)).rejects.toMatchObject({ status: 409 });
  });

  it("refuses a laboratory user; an arranger acts as SCAS", async () => {
    const { db, lab, ops, chain, attested } = await setup();
    await expect(recordSeasonAttestation(db, lab, veg, chain)).rejects.toMatchObject({ status: 403 });
    expect(attested).toEqual([]);
    await recordSeasonAttestation(db, ops, veg, chain);
    expect((await db.select().from(auditLog).where(eq(auditLog.action, "pool.attest_stage")))[0]?.actingRole).toBe("scas");
  });

  it("lists pools in season with their application", async () => {
    const { db } = await setup();
    expect((await scasPools(db)).map((p) => p.poolId)).toEqual(["9"]);
  });
});
