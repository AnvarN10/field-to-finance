import { describe, expect, it } from "vitest";
import { auditLog, farmerProfiles, investorProfiles } from "../src/lib/db/schema";
import { homeFor } from "../src/lib/auth/home";
import { openAccount } from "../src/lib/workflow/accounts";
import { testDb } from "./helpers/db";
import { makeUser } from "./helpers/workflow";

const db = await testDb();

describe("openAccount", () => {
  it("opens an investor account once, with its profile, and is idempotent for the same door", async () => {
    const u = await makeUser(db, "inv@example.com", []);
    expect(await openAccount(db, u, "investor")).toEqual(["investor"]);
    expect(await openAccount(db, { ...u, roles: ["investor"] }, "investor")).toEqual(["investor"]);
    expect((await db.select().from(investorProfiles)).filter((p) => p.userId === u.id)).toHaveLength(1);
    expect((await db.select().from(auditLog)).filter((a) => a.action === "account.open" && a.actorUserId === u.id)).toHaveLength(1);
  });

  it("treats a second tab opening the same door at once as success, not a conflict", async () => {
    const u = await makeUser(db, "twotabs@example.com", []);
    const results = await Promise.allSettled([openAccount(db, u, "investor"), openAccount(db, u, "investor")]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    expect((await db.select().from(investorProfiles)).filter((p) => p.userId === u.id)).toHaveLength(1);
  });

  it("opens an issuer account as the farmer account kind", async () => {
    const u = await makeUser(db, "farm@example.com", []);
    expect(await openAccount(db, u, "issuer")).toEqual(["farmer"]);
    expect((await db.select().from(farmerProfiles)).some((p) => p.userId === u.id)).toBe(true);
  });

  it("refuses the other door with a plain message", async () => {
    const u = await makeUser(db, "both@example.com", []);
    await openAccount(db, u, "investor");
    await expect(openAccount(db, u, "issuer")).rejects.toMatchObject({ status: 409, message: "This email already has an investor account. Use another email for an issuer account." });
    const f = await makeUser(db, "farm2@example.com", ["farmer"]);
    await expect(openAccount(db, f, "investor")).rejects.toMatchObject({ status: 409, message: "This email already has an issuer account. Use another email for an investor account." });
  });

  it("gives one account kind even when both doors race (unique index)", async () => {
    const u = await makeUser(db, "race@example.com", []);
    const results = await Promise.allSettled([openAccount(db, u, "issuer"), openAccount(db, u, "investor")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
  });

  it("refuses an unknown door", async () => {
    const u = await makeUser(db, "x@example.com", []);
    await expect(openAccount(db, u, "arranger" as never)).rejects.toMatchObject({ status: 400 });
  });

  it("lets a console member open one account kind", async () => {
    const u = await makeUser(db, "reg@example.com", ["regulator"]);
    expect(await openAccount(db, u, "investor")).toEqual(["investor", "regulator"]);
  });
});

describe("homeFor", () => {
  it("routes console members to the console, then issuers, then investors", () => {
    expect(homeFor(["regulator", "investor"])).toBe("/console");
    expect(homeFor(["farmer"])).toBe("/issuer");
    expect(homeFor(["investor"])).toBe("/invest");
    expect(homeFor([])).toBeNull();
  });
});
