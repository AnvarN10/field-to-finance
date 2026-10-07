import type { Role } from "../db/schema";
import { isConsoleRole } from "../permissions";

/** Where a signed-in account lands (ADR 0018): the console for members, else the issuer workspace, else the investor app. */
export function homeFor(roles: readonly Role[]): string | null {
  if (roles.some(isConsoleRole)) return "/console";
  if (roles.includes("farmer")) return "/issuer";
  if (roles.includes("investor")) return "/invest";
  return null;
}

/** Every app the account can open, for the account menu. */
export function appsFor(roles: readonly Role[]): { href: string; label: string }[] {
  return [
    ...(roles.some(isConsoleRole) ? [{ href: "/console", label: "Console" }] : []),
    ...(roles.includes("farmer") ? [{ href: "/issuer", label: "Issuer workspace" }] : []),
    ...(roles.includes("investor") ? [{ href: "/invest", label: "Investor app" }] : []),
  ];
}
