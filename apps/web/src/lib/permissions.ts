import type { Role } from "./db/schema";

/**
 * Console permissions (ADR 0018). Every console page, server action, route handler and workflow checks one of these,
 * never a role name. Console roles are named bundles of them; a user's permissions are the union over their roles.
 */
export const PERMISSIONS = [
  "applications.view",
  "applications.review",
  "pools.structure",
  "issuers.view",
  "investors.view",
  "kyc.decide",
  "kyc.revoke",
  "pools.view",
  "pools.operate",
  "verification.attest",
  "delivery.receipt",
  "delivery.lab",
  "registry.view",
  "registry.export",
  "documents.view",
  "audit.view",
  "team.manage",
  "settings.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Roles that open the console. `farmer` and `investor` are self-service account kinds, not console roles. */
export const CONSOLE_ROLES = ["arranger", "compliance", "scas", "elevator", "lab", "regulator"] as const satisfies readonly Role[];
export type ConsoleRole = (typeof CONSOLE_ROLES)[number];

/** The bundles. The arranger holds everything (the ADR 0017 pilot fallback); each partner keeps its own step. */
export const ROLE_PERMISSIONS: Record<ConsoleRole, readonly Permission[]> = {
  arranger: PERMISSIONS,
  compliance: ["issuers.view", "investors.view", "kyc.decide", "kyc.revoke"],
  scas: ["verification.attest"],
  elevator: ["delivery.receipt"],
  lab: ["delivery.lab"],
  regulator: ["registry.view", "registry.export"],
};

export const isConsoleRole = (r: string): r is ConsoleRole => (CONSOLE_ROLES as readonly string[]).includes(r);

export function permissionsOf(roles: readonly Role[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const r of roles) if (isConsoleRole(r)) for (const p of ROLE_PERMISSIONS[r]) out.add(p);
  return out;
}

type HasRoles = { roles: readonly Role[] } | null | undefined;

export const can = (user: HasRoles, p: Permission): boolean => !!user && permissionsOf(user.roles).has(p);

export const canAny = (user: HasRoles, ps: readonly Permission[]): boolean => ps.some((p) => can(user, p));

export const isConsoleMember = (user: HasRoles): boolean => !!user && user.roles.some(isConsoleRole);

/**
 * The role recorded in `audit_log.acting_role` for an action needing `p`: the user's narrowest role that grants it
 * (any role other than arranger), else arranger; null when no role grants it.
 */
export function actingRoleFor(roles: readonly Role[], p: Permission): ConsoleRole | null {
  const granting = CONSOLE_ROLES.filter((r) => roles.includes(r) && ROLE_PERMISSIONS[r].includes(p));
  return granting.find((r) => r !== "arranger") ?? granting[0] ?? null;
}

/** "You do not have permission to <verb>." */
export const PERMISSION_VERB: Record<Permission, string> = {
  "applications.view": "view applications",
  "applications.review": "review applications",
  "pools.structure": "structure pools",
  "issuers.view": "view issuers",
  "investors.view": "view investors",
  "kyc.decide": "decide KYC",
  "kyc.revoke": "revoke KYC",
  "pools.view": "view pools",
  "pools.operate": "operate pools",
  "verification.attest": "record verification attestations",
  "delivery.receipt": "record elevator receipts",
  "delivery.lab": "record lab protocols",
  "registry.view": "view the registry",
  "registry.export": "export the registry",
  "documents.view": "download documents",
  "audit.view": "view the audit log",
  "team.manage": "manage the team",
  "settings.manage": "change fees and treasury settings",
};

/** What each permission allows, for the Team page matrix. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "applications.view": "See applications and the pipeline",
  "applications.review": "Review documents, advance or reject applications",
  "pools.structure": "Build terms, create and publish pools",
  "issuers.view": "See issuer records, BIN and KYC files",
  "investors.view": "See investor records, IIN and questionnaires",
  "kyc.decide": "Approve or reject issuer and investor KYC",
  "kyc.revoke": "Revoke an investor",
  "pools.view": "See live pools, lifecycle and reports",
  "pools.operate": "Close, disburse, settle, sweep pools",
  "verification.attest": "Verify fields, record season attestations",
  "delivery.receipt": "Record elevator receipts",
  "delivery.lab": "Record lab protocols",
  "registry.view": "See the registry, holders and events",
  "registry.export": "Export registry CSV",
  "documents.view": "Download any stored document",
  "audit.view": "See the full audit log",
  "team.manage": "Invite and manage console members",
  "settings.manage": "Fees, treasury and test USDC",
};

export const CONSOLE_ROLE_LABELS: Record<ConsoleRole, { name: string; description: string }> = {
  arranger: { name: "Arranger", description: "F2F operations: every console section, the team and settings." },
  compliance: { name: "Compliance", description: "Issuer and investor KYC, revocations, retail limits." },
  scas: { name: "SCAS partner", description: "Field verification and season attestations. Sees no company identity." },
  elevator: { name: "Elevator", description: "Records the elevator receipt for delivery pools." },
  lab: { name: "Laboratory", description: "Records the 12-parameter lab protocol." },
  regulator: { name: "Regulator", description: "Read-only registry, holders, events and exports." },
};
