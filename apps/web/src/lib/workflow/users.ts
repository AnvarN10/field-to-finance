import type { SessionUser } from "../auth/session";
import { rolesOf } from "../auth/session";
import type { Db } from "../db/client";
import { isUniqueViolation } from "../db/errors";
import { farmerProfiles, investorProfiles, userRoles, type Role } from "../db/schema";
import { RequestError } from "../errors";
import { audit } from "./audit";

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
