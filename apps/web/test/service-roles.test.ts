import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { cabinetFor } from "../src/lib/auth/redirects";
import { auditLog, notifications } from "../src/lib/db/schema";
import { audit } from "../src/lib/workflow/audit";
import { assertPermission } from "../src/lib/workflow/guards";
import { grantRoleByEmail, listUsersWithRoles } from "../src/lib/workflow/users";
import { testDb } from "./helpers/db";
import { makeUser } from "./helpers/workflow";

const db = await testDb();
const ops = await makeUser(db, "ops@example.com", ["arranger"]);
const scas = await makeUser(db, "scas@example.com", ["scas"]);

describe("service roles", () => {
  it("an arranger grants every service role by email; one user may hold several", async () => {
    for (const r of ["compliance", "scas", "elevator", "lab", "regulator"] as const) await grantRoleByEmail(db, ops, "svc@example.com", r);
    const svc = (await listUsersWithRoles(db)).find((u) => u.email === "svc@example.com");
    expect(svc?.roles).toEqual(["compliance", "elevator", "lab", "regulator", "scas"]);
  });

  it("a service user cannot grant roles", async () => {
    await expect(grantRoleByEmail(db, scas, "x@example.com", "compliance")).rejects.toMatchObject({ status: 403 });
  });

  it("assertPermission: own role, arranger holds every service permission, other roles refused", () => {
    expect(assertPermission(scas, "verification.attest")).toMatchObject({ actingRole: "scas" });
    expect(assertPermission(ops, "delivery.lab")).toMatchObject({ actingRole: "arranger" });
    expect(() => assertPermission(scas, "kyc.decide")).toThrow(/decide KYC/);
    expect(() => assertPermission({ id: "x", email: "r@example.com", roles: ["regulator"] }, "delivery.receipt")).toThrow(/elevator receipts/);
  });

  it("audit rows record the acting role", async () => {
    await audit(db, { actorUserId: ops.id, actingRole: "compliance", action: "test.act", targetType: "user", targetId: ops.id });
    const [row] = await db.select().from(auditLog).where(eq(auditLog.action, "test.act"));
    expect(row?.actingRole).toBe("compliance");
  });

  it("a notification dedupe key is unique", async () => {
    await db.insert(notifications).values({ userId: ops.id, kind: "k", title: "t", body: "b", dedupeKey: "once" });
    await expect(db.insert(notifications).values({ userId: ops.id, kind: "k", title: "t", body: "b", dedupeKey: "once" })).rejects.toThrow();
    await db.insert(notifications).values({ userId: ops.id, kind: "k", title: "t", body: "b" });
    await db.insert(notifications).values({ userId: ops.id, kind: "k", title: "t", body: "b" });
  });

  it("service users land in their own cabinet", () => {
    expect(cabinetFor(["lab"])).toBe("/elevator");
    expect(cabinetFor(["elevator"])).toBe("/elevator");
    expect(cabinetFor(["compliance"])).toBe("/compliance");
    expect(cabinetFor(["scas"])).toBe("/scas");
    expect(cabinetFor(["regulator"])).toBe("/regulator");
    expect(cabinetFor(["arranger", "regulator"])).toBe("/arranger");
  });
});
