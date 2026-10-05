import { unstable_rethrow } from "next/navigation";
import type { ReactElement } from "react";
import type { SessionUser } from "../../lib/auth/session";
import { cabinetFor } from "../../lib/auth/redirects";
import type { Role, ServiceRole } from "../../lib/db/schema";
import { requireAnyRole, requireRole } from "../../lib/server/auth";
import { ErrorState } from "../state";
import { NoAccess } from "./no-access";

/**
 * Page guard for a cabinet: the user, or the element to render instead (403, or an error state when Postgres is down).
 * Signed-out visitors are redirected to sign-in by requireRole.
 */
export async function guardCabinet(role: Role, path: string): Promise<{ user: SessionUser } | { element: ReactElement }> {
  try {
    const access = await requireRole(role, path);
    if (!access.forbidden) return { user: access.user };
    const other = cabinetFor(access.user.roles.filter((r) => r !== role));
    return { element: <NoAccess role={role} email={access.user.email} otherCabinet={other} /> };
  } catch (e) {
    unstable_rethrow(e);
    return {
      element: (
        <ErrorState level={1} title="Your cabinet is unavailable" body="Accounts could not be loaded. Pool pages still work; try the cabinet again in a minute." retryHref={path} />
      ),
    };
  }
}

/** Page guard for a service cabinet (ADR 0017): the user and the roles they may act as on it; arrangers get every listed role. */
export async function guardServiceCabinet(roles: ServiceRole[], path: string): Promise<{ user: SessionUser; roles: ServiceRole[] } | { element: ReactElement }> {
  try {
    const access = await requireAnyRole(roles, path);
    if (!access.forbidden) return { user: access.user, roles: access.roles };
    const other = cabinetFor(access.user.roles);
    return { element: <NoAccess role={roles[0] as Role} email={access.user.email} otherCabinet={other} /> };
  } catch (e) {
    unstable_rethrow(e);
    return {
      element: <ErrorState level={1} title="Your cabinet is unavailable" body="Accounts could not be loaded. Pool pages still work; try the cabinet again in a minute." retryHref={path} />,
    };
  }
}
