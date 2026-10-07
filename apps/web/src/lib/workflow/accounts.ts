import { rolesOf, type SessionUser } from "../auth/session";
import type { Db } from "../db/client";
import { isUniqueViolation } from "../db/errors";
import { farmerProfiles, investorProfiles, userRoles, type Role } from "../db/schema";
import { RequestError } from "../errors";
import { audit } from "./audit";

export type Door = "investor" | "issuer";
const KIND: Record<Door, "investor" | "farmer"> = { investor: "investor", issuer: "farmer" };
const NAME = { investor: "an investor", farmer: "an issuer" } as const;

/**
 * Opens the account kind a door stands for (ADR 0018): `/invest/signup` opens an investor account, `/apply/start` an
 * issuer (`farmer`) account. Idempotent for the same door; one self-service account kind per email, so the other door
 * answers 409 (the unique index `user_roles_one_self_cabinet` also refuses it under a race).
 */
export async function openAccount(db: Db, user: SessionUser, door: Door): Promise<Role[]> {
  const kind = KIND[door];
  if (!kind) throw new RequestError("Unknown sign-up door.", 400);
  const other = kind === "farmer" ? "investor" : "farmer";
  const taken = () => new RequestError(`This email already has ${NAME[other]} account. Use another email for ${NAME[kind]} account.`, 409);
  const current = await rolesOf(db, user.id);
  if (current.includes(kind)) return current;
  if (current.includes(other)) throw taken();
  // Role, profile and audit row land together or not at all.
  try {
    await db.transaction(async (tx) => {
      await tx.insert(userRoles).values({ userId: user.id, role: kind, grantedBy: user.id });
      if (kind === "farmer") await tx.insert(farmerProfiles).values({ userId: user.id }).onConflictDoNothing();
      else await tx.insert(investorProfiles).values({ userId: user.id }).onConflictDoNothing();
      await audit(tx as unknown as Db, { actorUserId: user.id, action: "account.open", targetType: "user", targetId: user.id, payload: { door } });
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // A second tab or a retry may have opened this very account a moment ago: that is success, not a conflict.
    const now = await rolesOf(db, user.id);
    if (now.includes(kind)) return now;
    throw taken();
  }
  return rolesOf(db, user.id);
}
