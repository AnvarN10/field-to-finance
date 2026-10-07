import { unstable_rethrow } from "next/navigation";
import type { ReactElement } from "react";
import type { SessionUser } from "../../lib/auth/session";
import { isConsoleMember, permissionsOf, type Permission } from "../../lib/permissions";
import { signedInUser } from "../../lib/server/auth";
import { ErrorState } from "../state";
import { MissingPermission, NotAMember } from "./forbidden";

export type ConsoleAccess = { user: SessionUser; permissions: Set<Permission> };

/**
 * Page guard for the console (ADR 0018): signed out → sign-in; no console role → "invitation only"; missing permission →
 * an explanation inside the shell; Postgres down → error state. `need` null: any member; an array: any of them.
 */
export async function guardConsole(need: Permission | Permission[] | null, path: string): Promise<ConsoleAccess | { element: ReactElement }> {
  try {
    const user = await signedInUser(path);
    if (!isConsoleMember(user)) return { element: <NotAMember email={user.email} roles={user.roles} /> };
    const permissions = permissionsOf(user.roles);
    const wanted = need === null ? [] : Array.isArray(need) ? need : [need];
    if (wanted.length && !wanted.some((p) => permissions.has(p))) return { element: <MissingPermission need={wanted} /> };
    return { user, permissions };
  } catch (e) {
    unstable_rethrow(e);
    return { element: <ErrorState level={1} title="The console is unavailable" body="Accounts could not be loaded. Pool pages still work; try again in a minute." retryHref={path} /> };
  }
}
