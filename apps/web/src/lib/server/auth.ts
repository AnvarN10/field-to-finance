import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkRole, resolveSession, SESSION_COOKIE, type SessionUser } from "../auth/session";
import type { Role } from "../db/schema";
import { RequestError } from "../errors";
import { getDb } from "./db";
import { getPrivy } from "./privy";

/** The signed-in user, verified against Privy and Postgres on every call. Throws when Postgres is unavailable. */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSession(await getDb(), getPrivy(), token);
}

export type PageAccess = { forbidden: false; user: SessionUser } | { forbidden: true; user: SessionUser };

/** Page guard: redirects a signed-out visitor to sign-in; a missing role renders the 403 state. */
export async function requireRole(role: Role, nextPath: string): Promise<PageAccess> {
  const user = await currentUser();
  const check = checkRole(user, role);
  if (check === "signin" || !user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return { forbidden: check === "forbidden", user };
}

/** Server action and route guard: throws a RequestError the caller turns into a plain message. */
export async function requireActionRole(role: Role): Promise<SessionUser> {
  const user = await currentUser();
  const check = checkRole(user, role);
  if (check === "signin" || !user) throw new RequestError("Your session expired. Sign in again.", 401);
  if (check === "forbidden") throw new RequestError(`Your account does not have the ${role} role.`, 403);
  return user;
}
