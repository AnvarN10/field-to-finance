import type { Permission } from "../../lib/permissions";

export type ConsoleIcon = "inbox" | "applications" | "issuers" | "investors" | "pools" | "settlement" | "verification" | "delivery" | "registry" | "audit" | "team" | "settings";
export type ConsoleNavItem = { href: string; label: string; icon: ConsoleIcon; permission: Permission | Permission[] | null };

/** Console sections in order (spec §6.1). `null`: every console member; an array: any of them. */
export const CONSOLE_NAV: ConsoleNavItem[] = [
  { href: "/console", label: "Inbox", icon: "inbox", permission: null },
  { href: "/console/applications", label: "Applications", icon: "applications", permission: "applications.view" },
  { href: "/console/issuers", label: "Issuers", icon: "issuers", permission: "issuers.view" },
  { href: "/console/investors", label: "Investors", icon: "investors", permission: "investors.view" },
  { href: "/console/pools", label: "Pools", icon: "pools", permission: "pools.view" },
  { href: "/console/settlement", label: "Settlement", icon: "settlement", permission: "pools.operate" },
  { href: "/console/verification", label: "Verification", icon: "verification", permission: "verification.attest" },
  { href: "/console/delivery", label: "Delivery", icon: "delivery", permission: ["delivery.receipt", "delivery.lab"] },
  { href: "/console/registry", label: "Registry", icon: "registry", permission: "registry.view" },
  { href: "/console/audit", label: "Audit", icon: "audit", permission: "audit.view" },
  { href: "/console/team", label: "Team", icon: "team", permission: "team.manage" },
  { href: "/console/settings", label: "Settings", icon: "settings", permission: "settings.manage" },
];

export const allows = (perms: ReadonlySet<Permission>, need: ConsoleNavItem["permission"]) =>
  need === null ? true : Array.isArray(need) ? need.some((p) => perms.has(p)) : perms.has(need);

export const navFor = (perms: ReadonlySet<Permission>) => CONSOLE_NAV.filter((i) => allows(perms, i.permission));
