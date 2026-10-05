import type { Role } from "../db/schema";
import { ROLE_CABINET, ROLE_PRIORITY } from "../roles";

/** A same-origin path to return to after sign-in, or null. Rejects protocol-relative and backslash tricks. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.length > 512) return null;
  return next;
}

/** Each role's cabinet; an arranger lands in the arranger cabinet first. */
export function cabinetFor(roles: readonly Role[]): string | null {
  const first = ROLE_PRIORITY.find((r) => roles.includes(r));
  return first ? ROLE_CABINET[first] : null;
}
