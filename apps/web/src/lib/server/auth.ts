import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { checkRole, resolveSession, SESSION_COOKIE, type SessionUser } from "../auth/session";
import type { Role, ServiceRole } from "../db/schema";
import { RequestError } from "../errors";
import type { Permission } from "../permissions";
import { assertAccount, assertPermission, type ConsoleActor } from "../workflow/guards";
import { getDb } from "./db";
import { getPrivy } from "./privy";

/**
 * The signed-in user, verified against Privy and Postgres (deduplicated within one request). Throws when Postgres is
 * unavailable.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSession(await getDb(), getPrivy(), token);
});

/** Server action and route guard for the console (ADR 0018): 401 signed out, 403 without the permission. */
export async function requirePermission(permission: Permission): Promise<ConsoleActor> {
  const user = await currentUser();
  if (!user) throw new RequestError("Your session expired. Sign in again.", 401);
  return assertPermission(user, permission);
}

/** Server action and route guard for the investor app and the issuer workspace. */
export async function requireAccount(kind: "farmer" | "investor"): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new RequestError("Your session expired. Sign in again.", 401);
  assertAccount(user, kind);
  return user;
}

/** Page helper: the signed-in user, or a redirect to sign-in that returns to `nextPath`. */
export async function signedInUser(nextPath: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
}

// ---- Page guards of the old cabinets; removed when their pages move (Tasks 8–11). ----

export type PageAccess = { forbidden: false; user: SessionUser } | { forbidden: true; user: SessionUser };

export async function requireRole(role: Role, nextPath: string): Promise<PageAccess> {
  const user = await currentUser();
  const check = checkRole(user, role);
  if (check === "signin" || !user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return { forbidden: check === "forbidden", user };
}

export type ServicePageAccess = { forbidden: boolean; user: SessionUser; roles: ServiceRole[] };

export async function requireAnyRole(roles: ServiceRole[], nextPath: string): Promise<ServicePageAccess> {
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  const allowed = user.roles.includes("arranger") ? roles : roles.filter((r) => user.roles.includes(r));
  return { forbidden: allowed.length === 0, user, roles: allowed };
}
