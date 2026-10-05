import type { Role } from "../db/schema";

/** A same-origin path to return to after sign-in, or null. Rejects protocol-relative and backslash tricks. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.length > 512) return null;
  return next;
}

/** Each role's cabinet; an arranger lands in the arranger cabinet first. */
export function cabinetFor(roles: readonly Role[]): string | null {
  if (roles.includes("arranger")) return "/arranger";
  if (roles.includes("farmer")) return "/farmer";
  if (roles.includes("investor")) return "/investor";
  return null;
}
