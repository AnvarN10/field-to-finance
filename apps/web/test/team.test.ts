import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditLog, consoleInvitations, notifications, userRoles } from "../src/lib/db/schema";
import { rolesOf } from "../src/lib/auth/session";
import { acceptInvitation, createInvitation, inspectInvitation, listInvitations, listMembers, maskEmail, revokeInvitation, setMemberRoles } from "../src/lib/workflow/team";
import { testDb } from "./helpers/db";
import { makeUser } from "./helpers/workflow";

const db = await testDb();
const ops = await makeUser(db, "ops@example.com", ["arranger"]);
const officer = await makeUser(db, "co@example.com", ["compliance"]);
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

describe("invitations", () => {
  it("stores only the token hash and expires in 7 days", async () => {
    const now = new Date("2026-10-07T10:00:00Z");
    const inv = await createInvitation(db, ops, { email: " New@Example.com ", roles: ["scas"] }, now);
    expect(inv.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [row] = await db.select().from(consoleInvitations).where(eq(consoleInvitations.id, inv.id));
    expect(row).toMatchObject({ email: "new@example.com", roles: ["scas"], tokenHash: sha(inv.token), invitedBy: ops.id });
    expect(JSON.stringify(row)).not.toContain(inv.token);
    expect(inv.expiresAt.toISOString()).toBe("2026-10-14T10:00:00.000Z");
    expect(await inspectInvitation(db, inv.token, now)).toMatchObject({ state: "valid", roles: ["scas"], maskedEmail: "n***@example.com" });
  });

  it("re-inviting an email revokes its open invitation", async () => {
    const a = await createInvitation(db, ops, { email: "twice@example.com", roles: ["lab"] });
    const b = await createInvitation(db, ops, { email: "twice@example.com", roles: ["elevator"] });
    expect((await inspectInvitation(db, a.token)).state).toBe("revoked");
    expect((await inspectInvitation(db, b.token)).state).toBe("valid");
    expect((await listInvitations(db)).filter((i) => i.email === "twice@example.com")).toHaveLength(1);
  });

  it("refuses without team.manage, an empty role list and account kinds", async () => {
    await expect(createInvitation(db, officer, { email: "x@example.com", roles: ["scas"] })).rejects.toMatchObject({ status: 403 });
    await expect(createInvitation(db, ops, { email: "x@example.com", roles: [] })).rejects.toMatchObject({ status: 400 });
    await expect(createInvitation(db, ops, { email: "x@example.com", roles: ["investor" as never] })).rejects.toMatchObject({ status: 400 });
    await expect(createInvitation(db, ops, { email: "not-an-email", roles: ["scas"] })).rejects.toMatchObject({ status: 400 });
  });

  it("an unknown token is just invalid", async () => {
    expect(await inspectInvitation(db, "nope")).toEqual({ state: "invalid" });
    expect(await inspectInvitation(db, "A".repeat(43))).toEqual({ state: "invalid" });
  });

  it("accept needs the invited email, grants every role once, audits and notifies the inviter", async () => {
    const inv = await createInvitation(db, ops, { email: "partner@example.com", roles: ["elevator", "lab"] });
    const stranger = await makeUser(db, "stranger@example.com", []);
    await expect(acceptInvitation(db, stranger, inv.token)).rejects.toMatchObject({ status: 403, message: "This invitation is for another email." });
    expect(await rolesOf(db, stranger.id)).toEqual([]);
    const partner = await makeUser(db, "partner@example.com", []);
    expect(await acceptInvitation(db, partner, inv.token)).toEqual(["elevator", "lab"]);
    expect(await rolesOf(db, partner.id)).toEqual(["elevator", "lab"]);
    const grants = await db.select().from(userRoles).where(eq(userRoles.userId, partner.id));
    expect(grants.every((g) => g.grantedBy === ops.id)).toBe(true);
    expect((await db.select().from(auditLog)).some((a) => a.action === "team.invitation.accept" && a.actorUserId === partner.id)).toBe(true);
    expect((await db.select().from(notifications).where(eq(notifications.userId, ops.id))).some((n) => n.kind === "team")).toBe(true);
    await expect(acceptInvitation(db, partner, inv.token)).rejects.toMatchObject({ status: 410 });
    expect((await inspectInvitation(db, inv.token)).state).toBe("used");
  });

  it("refuses expired and revoked invitations", async () => {
    const now = new Date("2026-10-07T10:00:00Z");
    const late = await createInvitation(db, ops, { email: "late@example.com", roles: ["scas"] }, now);
    const lateUser = await makeUser(db, "late@example.com", []);
    await expect(acceptInvitation(db, lateUser, late.token, new Date("2026-10-15T10:00:00Z"))).rejects.toMatchObject({ status: 410 });
    expect((await inspectInvitation(db, late.token, new Date("2026-10-15T10:00:00Z"))).state).toBe("expired");
    const gone = await createInvitation(db, ops, { email: "gone@example.com", roles: ["scas"] });
    await revokeInvitation(db, ops, gone.id);
    const goneUser = await makeUser(db, "gone@example.com", []);
    await expect(acceptInvitation(db, goneUser, gone.token)).rejects.toMatchObject({ status: 410 });
    expect(await rolesOf(db, goneUser.id)).toEqual([]);
  });

  it("two concurrent accepts: exactly one wins", async () => {
    const inv = await createInvitation(db, ops, { email: "race@example.com", roles: ["regulator"] });
    const u = await makeUser(db, "race@example.com", []);
    const r = await Promise.allSettled([acceptInvitation(db, u, inv.token), acceptInvitation(db, u, inv.token)]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await db.select().from(auditLog)).filter((a) => a.action === "team.invitation.accept" && a.actorUserId === u.id)).toHaveLength(1);
  });

  it("revoking needs team.manage", async () => {
    const inv = await createInvitation(db, ops, { email: "keep@example.com", roles: ["scas"] });
    await expect(revokeInvitation(db, officer, inv.id)).rejects.toMatchObject({ status: 403 });
  });
});

describe("members", () => {
  it("lists console members only, with their console roles", async () => {
    await makeUser(db, "investor-only@example.com", ["investor"]);
    const members = await listMembers(db);
    expect(members.find((m) => m.email === "investor-only@example.com")).toBeUndefined();
    expect(members.find((m) => m.email === "co@example.com")?.roles).toEqual(["compliance"]);
  });

  it("setMemberRoles replaces console roles, keeps account kinds and the last arranger", async () => {
    const both = await makeUser(db, "both@example.com", ["investor", "scas"]);
    await setMemberRoles(db, ops, both.id, ["lab"]);
    expect(await rolesOf(db, both.id)).toEqual(["investor", "lab"]);
    await setMemberRoles(db, ops, both.id, []);
    expect(await rolesOf(db, both.id)).toEqual(["investor"]);
    await expect(setMemberRoles(db, ops, ops.id, ["compliance"])).rejects.toMatchObject({ status: 409 });
    await expect(setMemberRoles(db, officer, both.id, ["lab"])).rejects.toMatchObject({ status: 403 });
    await expect(setMemberRoles(db, ops, both.id, ["farmer" as never])).rejects.toMatchObject({ status: 400 });
  });

  it("keeps an arranger when two arrangers remove each other at the same time", async () => {
    const db2 = await testDb();
    const a = await makeUser(db2, "a@example.com", ["arranger"]);
    const b = await makeUser(db2, "b@example.com", ["arranger"]);
    const results = await Promise.allSettled([setMemberRoles(db2, a, b.id, []), setMemberRoles(db2, b, a.id, [])]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { message: "Keep at least one arranger." } });
    expect((await listMembers(db2)).filter((m) => m.roles.includes("arranger"))).toHaveLength(1);
  });

  it("refuses to strip an ARRANGER_EMAILS address of the arranger role", async () => {
    const boot = await makeUser(db, "boot@example.com", ["arranger"]);
    await expect(setMemberRoles(db, ops, boot.id, [], ["boot@example.com"])).rejects.toMatchObject({ status: 409 });
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("alice@example.com")).toBe("a***@example.com");
    expect(maskEmail("x@y.kz")).toBe("x***@y.kz");
  });
});
