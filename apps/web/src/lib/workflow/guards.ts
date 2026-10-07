import type { SessionUser } from "../auth/session";
import { RequestError } from "../errors";
import { actingRoleFor, PERMISSION_VERB, type ConsoleRole, type Permission } from "../permissions";

/** Who acts in the console, through which permission and as which role (recorded in `audit_log.acting_role`). */
export type ConsoleActor = { user: SessionUser; permission: Permission; actingRole: ConsoleRole };

/** A console action (ADR 0018): one of the user's console roles grants `permission`; else 403. */
export function assertPermission(user: SessionUser, permission: Permission): ConsoleActor {
  const actingRole = actingRoleFor(user.roles, permission);
  if (!actingRole) throw new RequestError(`You do not have permission to ${PERMISSION_VERB[permission]}.`, 403);
  return { user, permission, actingRole };
}

const ACCOUNT_NAME = { farmer: "an issuer", investor: "an investor" } as const;

/** A self-service action: the user opened an issuer (`farmer`) or investor account through its door. */
export function assertAccount(user: SessionUser, kind: "farmer" | "investor"): void {
  if (!user.roles.includes(kind)) throw new RequestError(`This needs ${ACCOUNT_NAME[kind]} account.`, 403);
}

const UUID =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres rejects a malformed uuid with a driver error; answer "not found" instead. */
export function assertUuid(id: string, what: string): void {
  if (!UUID.test(id)) throw new RequestError(`${what} not found`, 404);
}

export function parseOr400<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new RequestError(r.error.issues.map((i) => `${i.path.map(String).join(".") || "input"}: ${i.message}`).join("; "), 400);
  return r.data;
}
