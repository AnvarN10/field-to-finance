import { describe, expect, it } from "vitest";
import { applications, farmerProfiles, investorProfiles } from "../src/lib/db/schema";
import { permissionsOf } from "../src/lib/permissions";
import { inboxQueues } from "../src/lib/workflow/inbox";
import { testDb } from "./helpers/db";
import { poolDetail, poolView, terms } from "./helpers/pool";
import { makeUser } from "./helpers/workflow";

const db = await testDb();
const farmer = await makeUser(db, "farm@example.com", ["farmer"]);
await db.insert(farmerProfiles).values({ userId: farmer.id, legalName: "Demo Farm LLP", kycStatus: "pending" });
const inv = await makeUser(db, "inv@example.com", ["investor"]);
await db.insert(investorProfiles).values({ userId: inv.id, category: "retail", kycStatus: "pending" });
const app = (status: string) => ({ farmerUserId: farmer.id, crop: "wheat", grade: "3", volumeT: 1000, tokenizedShareBps: 3000, requestedUsd: 100000, proposedCouponBps: 1200, season: 2027, elevator: "E", lab: "L", status: status as never });
await db.insert(applications).values([app("submitted"), app("field_verification"), app("draft")]);

const now = 1_800_000_000;
const delivery = poolView({ poolId: "9", status: "Funded", terms: terms({ settlementMode: "Hybrid", receiptHash: null, labPassed: false }) });
const chain = { pools: [delivery], details: [poolDetail({ pool: { poolId: "4", status: "Draft" } })] };
const keys = async (roles: Parameters<typeof permissionsOf>[0]) => (await inboxQueues(db, permissionsOf(roles), chain, now)).map((q) => q.key);

describe("inboxQueues", () => {
  it("gives each role only the queues its permissions open", async () => {
    expect(await keys(["arranger"])).toEqual(["applications", "issuer-kyc", "investor-kyc", "fields", "pool-actions", "receipts", "lab"]);
    expect(await keys(["compliance"])).toEqual(["issuer-kyc", "investor-kyc"]);
    expect(await keys(["scas"])).toEqual(["fields"]);
    expect(await keys(["elevator"])).toEqual(["receipts"]);
    expect(await keys(["lab"])).toEqual(["lab"]);
    expect(await keys(["regulator"])).toEqual([]);
  });

  it("counts items where the reviewer acts next and links each one", async () => {
    const qs = await inboxQueues(db, permissionsOf(["arranger"]), chain, now);
    const apps = qs.find((q) => q.key === "applications")!;
    expect(apps.count).toBe(1);
    expect(apps.items[0]!.href).toMatch(/^\/console\/applications\/[0-9a-f-]{36}$/);
    expect(qs.find((q) => q.key === "pool-actions")).toMatchObject({ count: 1, items: [{ href: "/console/pools/4" }] });
    expect(qs.find((q) => q.key === "receipts")).toMatchObject({ count: 1, items: [{ href: "/console/delivery?pool=9" }] });
  });

  it("never shows company identity or emails in the SCAS partner's queue", async () => {
    const [fields] = await inboxQueues(db, permissionsOf(["scas"]), chain, now);
    expect(JSON.stringify(fields)).not.toMatch(/Demo Farm|@example\.com/);
    expect(fields!.items[0]!.label).toBe("wheat 2027");
  });

  it("marks chain queues unavailable when devnet did not answer", async () => {
    const qs = await inboxQueues(db, permissionsOf(["elevator"]), null, now);
    expect(qs).toEqual([expect.objectContaining({ key: "receipts", unavailable: true, count: 0 })]);
  });
});
