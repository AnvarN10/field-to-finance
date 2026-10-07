import { describe, expect, it } from "vitest";
import { farmerProfiles } from "../src/lib/db/schema";
import { rolesOf } from "../src/lib/auth/session";
import { chooseRole } from "../src/lib/workflow/users";
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




  it("gives one self-chosen cabinet even when two choices race (unique index)", async () => {
    const db = await testDb();
    const u = await makeUser(db, "race@example.com", []);
    const results = await Promise.allSettled([chooseRole(db, u, "farmer"), chooseRole(db, u, "investor")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    const roles = await rolesOf(db, u.id);
    expect(roles).toHaveLength(1);
  });


});
