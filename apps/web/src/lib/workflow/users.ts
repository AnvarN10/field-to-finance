import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { normalizeEmail, rolesOf, type SessionUser } from "../auth/session";
import type { Db } from "../db/client";
import { isUniqueViolation } from "../db/errors";
import { farmerProfiles, investorProfiles, ROLES, userRoles, users, type Role } from "../db/schema";
import { RequestError } from "../errors";
import { audit } from "./audit";
import { assertPermission, assertUuid } from "./guards";
import { notify } from "./notifications";

async function ensureProfile(db: Db, userId: string, role: Role): Promise<void> {
  if (role === "farmer") await db.insert(farmerProfiles).values({ userId }).onConflictDoNothing();
  if (role === "investor") await db.insert(investorProfiles).values({ userId }).onConflictDoNothing();
}

/** "I am a farmer" / "I am an investor": granted at once; onboarding gates what the role can do. One cabinet per account. */
export async function chooseRole(db: Db, user: SessionUser, role: "farmer" | "investor"): Promise<Role[]> {
  if (role !== "farmer" && role !== "investor") throw new RequestError("Choose farmer or investor.", 400);
  const taken = () => new RequestError("Your account already has a cabinet. Ask an arranger to change it.", 409);
  const current = await rolesOf(db, user.id);
  if (current.includes("farmer") || current.includes("investor")) throw taken();
  // Two parallel clicks both pass the check above; the unique index user_roles_one_self_cabinet refuses the second.
  try {
    await db.insert(userRoles).values({ userId: user.id, role, grantedBy: user.id });
  } catch (e) {
    if (isUniqueViolation(e)) throw taken();
    throw e;
  }
  await ensureProfile(db, user.id, role);
  await audit(db, { actorUserId: user.id, action: "role.choose", targetType: "user", targetId: user.id, payload: { role } });
  return rolesOf(db, user.id);
}

const grantInput = z.object({ email: z.email({ error: "enter a valid email" }), role: z.enum(ROLES) });

/** Arranger grants a role by email; an account that never signed in is created and attached on its first sign-in. */
export async function grantRoleByEmail(db: Db, actor: SessionUser, email: string, role: Role): Promise<void> {
  assertPermission(actor, "team.manage");
  const parsed = grantInput.safeParse({ email: normalizeEmail(email), role });
  if (!parsed.success) throw new RequestError(parsed.error.issues[0]?.message ?? "Check the email and role", 400);
  const e = parsed.data.email;
  let user = await db.query.users.findFirst({ where: eq(users.email, e) });
  user ??= (await db.insert(users).values({ email: e }).returning())[0];
  if (!user) throw new Error("user insert returned no row");
  await db.insert(userRoles).values({ userId: user.id, role, grantedBy: actor.id }).onConflictDoNothing();
  await ensureProfile(db, user.id, role);
  await audit(db, { actorUserId: actor.id, action: "role.grant", targetType: "user", targetId: user.id, payload: { role } });
  await notify(db, user.id, "role", `You have the ${role} role`, `An arranger gave your account access to the ${role} cabinet.`);
}

/**
 * Removes a role. The last-arranger check and the delete run in one transaction that locks every arranger row, so two
 * arrangers removing each other at the same time cannot leave the platform with none. `arrangerEmails` (ARRANGER_EMAILS)
 * would grant the role back on the next sign-in, so those addresses are refused here.
 */
export async function revokeRole(db: Db, actor: SessionUser, userId: string, role: Role, arrangerEmails: string[] = []): Promise<void> {
  assertPermission(actor, "team.manage");
  assertUuid(userId, "User");
  await db.transaction(async (tx) => {
    if (role === "arranger") {
      if (userId === actor.id) throw new RequestError("You cannot remove your own arranger role.", 409);
      const target = await tx.query.users.findFirst({ where: eq(users.id, userId) });
      if (target && arrangerEmails.includes(target.email)) throw new RequestError("This address is in ARRANGER_EMAILS and gets the role back at sign-in. Remove it there first.", 409);
      const arrangers = await tx.select({ userId: userRoles.userId }).from(userRoles).where(eq(userRoles.role, "arranger")).for("update");
      if (arrangers.length <= 1 && arrangers.some((a) => a.userId === userId)) throw new RequestError("Keep at least one arranger.", 409);
    }
    const removed = await tx.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role))).returning();
    if (!removed.length) throw new RequestError("The user does not have that role.", 404);
    await audit(tx as unknown as Db, { actorUserId: actor.id, action: "role.revoke", targetType: "user", targetId: userId, payload: { role } });
  });
}

export interface UserWithRoles {
  id: string;
  email: string;
  roles: Role[];
  signedIn: boolean;
  createdAt: Date;
}

export async function listUsersWithRoles(db: Db): Promise<UserWithRoles[]> {
  const [rows, roles] = await Promise.all([db.select().from(users).orderBy(asc(users.createdAt)), db.select().from(userRoles)]);
  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    roles: roles.filter((r) => r.userId === u.id).map((r) => r.role).sort(),
    signedIn: u.privyDid !== null,
    createdAt: u.createdAt,
  }));
}
