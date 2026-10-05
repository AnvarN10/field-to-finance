import type { SessionUser } from "../auth/session";
import type { Role } from "../db/schema";
import { RequestError } from "../errors";

export function assertRole(user: SessionUser, role: Role): void {
  if (!user.roles.includes(role)) throw new RequestError(`Your account does not have the ${role} role.`, 403);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres rejects a malformed uuid with a driver error; answer "not found" instead. */
export function assertUuid(id: string, what: string): void {
  if (!UUID.test(id)) throw new RequestError(`${what} not found`, 404);
}

export function parseOr400<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new RequestError(r.error.issues.map((i) => `${i.path.map(String).join(".") || "input"}: ${i.message}`).join("; "), 400);
  return r.data;
}
