import { describe, expect, it } from "vitest";
import { auditLog, farmerProfiles, investorProfiles } from "../src/lib/db/schema";
import { chooseRole, grantRoleByEmail, listUsersWithRoles, revokeRole } from "../src/lib/workflow/users";
import { testDb } from "./helpers/db";
import { makeUser } from "./helpers/workflow";

describe("roles", () => {
  it("lets a new user choose farmer or investor once and creates the profile", async () => {
    const db = await testDb();
    const u = await makeUser(db, "new@example.com", []);
    expect(await chooseRole(db, u, "farmer")).toEqual(["farmer"]);
    expect(await db.select().from(farmerProfiles)).toHaveLength(1);
    await expect(chooseRole(db, { ...u, roles: ["farmer"] }, "investor")).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to self-grant the arranger role", async () => {
    const db = await testDb();
    const u = await makeUser(db, "new@example.com", []);
    await expect(chooseRole(db, u, "arranger" as never)).rejects.toMatchObject({ status: 400 });
  });

  it("grants by email, creating a pending account, and audits it", async () => {
    const db = await testDb();
    const ops = await makeUser(db, "ops@example.com", ["arranger"]);
    await grantRoleByEmail(db, ops, " Investor@Example.com ", "investor");
    const list = await listUsersWithRoles(db);
    expect(list.find((u) => u.email === "investor@example.com")).toMatchObject({ roles: ["investor"], signedIn: false });
    expect(await db.select().from(investorProfiles)).toHaveLength(1);
    expect((await db.select().from(auditLog))[0]).toMatchObject({ action: "role.grant", targetType: "user" });
    await expect(grantRoleByEmail(db, ops, "not-an-email", "farmer")).rejects.toMatchObject({ status: 400 });
  });

  it("refuses to revoke your own arranger role and the last arranger", async () => {
    const db = await testDb();
    const ops = await makeUser(db, "ops@example.com", ["arranger"]);
    await expect(revokeRole(db, ops, ops.id, "arranger")).rejects.toMatchObject({ status: 409, message: "You cannot remove your own arranger role." });
    const other = await makeUser(db, "two@example.com", ["arranger"]);
    await revokeRole(db, ops, other.id, "arranger");
    expect((await listUsersWithRoles(db)).find((u) => u.id === other.id)?.roles).toEqual([]);
  });

  it("refuses to revoke the last arranger even when another arranger asks", async () => {
    const db = await testDb();
    const ops = await makeUser(db, "ops@example.com", ["arranger"]);
    const stale = { id: "00000000-0000-0000-0000-000000000000", email: "x@example.com", roles: ["arranger" as const] };
    await expect(revokeRole(db, stale, ops.id, "arranger")).rejects.toMatchObject({ status: 409, message: "Keep at least one arranger." });
  });

  it("gives one self-chosen cabinet even when two choices race (unique index)", async () => {
    const db = await testDb();
    const u = await makeUser(db, "race@example.com", []);
    const results = await Promise.allSettled([chooseRole(db, u, "farmer"), chooseRole(db, u, "investor")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    const roles = (await listUsersWithRoles(db)).find((x) => x.id === u.id)?.roles;
    expect(roles).toHaveLength(1);
  });

  it("keeps an arranger when two arrangers remove each other at the same time", async () => {
    const db = await testDb();
    const a = await makeUser(db, "a@example.com", ["arranger"]);
    const b = await makeUser(db, "b@example.com", ["arranger"]);
    const results = await Promise.allSettled([revokeRole(db, a, b.id, "arranger"), revokeRole(db, b, a.id, "arranger")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { message: "Keep at least one arranger." } });
    expect((await listUsersWithRoles(db)).filter((u) => u.roles.includes("arranger"))).toHaveLength(1);
  });

  it("refuses to revoke the arranger role of an ARRANGER_EMAILS address (it would come back at sign-in)", async () => {
    const db = await testDb();
    const ops = await makeUser(db, "ops@example.com", ["arranger"]);
    const listed = await makeUser(db, "listed@example.com", ["arranger"]);
    await expect(revokeRole(db, ops, listed.id, "arranger", ["listed@example.com"])).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/ARRANGER_EMAILS/) });
  });
});
