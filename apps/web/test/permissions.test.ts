import { describe, expect, it } from "vitest";
import { actingRoleFor, can, CONSOLE_ROLES, isConsoleMember, PERMISSIONS, permissionsOf, ROLE_PERMISSIONS } from "../src/lib/permissions";
import { assertAccount, assertPermission } from "../src/lib/workflow/guards";

const MATRIX: Record<string, string[]> = {
  arranger: [...PERMISSIONS],
  compliance: ["issuers.view", "investors.view", "kyc.decide", "kyc.revoke"],
  scas: ["verification.attest"],
  elevator: ["delivery.receipt"],
  lab: ["delivery.lab"],
  regulator: ["registry.view", "registry.export"],
};

describe("permission matrix", () => {
  it("is pinned", () => {
    expect(PERMISSIONS).toHaveLength(18);
    for (const r of CONSOLE_ROLES) expect([...ROLE_PERMISSIONS[r]].sort()).toEqual([...MATRIX[r]!].sort());
  });

  it("unions console roles and ignores account kinds", () => {
    expect([...permissionsOf(["scas", "lab", "investor"])].sort()).toEqual(["delivery.lab", "verification.attest"]);
    expect(permissionsOf(["farmer", "investor"]).size).toBe(0);
    expect(isConsoleMember({ roles: ["investor"] })).toBe(false);
    expect(isConsoleMember({ roles: ["regulator"] })).toBe(true);
    expect(isConsoleMember(null)).toBe(false);
    expect(can(null, "audit.view")).toBe(false);
    expect(can({ roles: ["compliance"] }, "kyc.decide")).toBe(true);
    expect(can({ roles: ["compliance"] }, "documents.view")).toBe(false);
  });

  it("picks the narrowest acting role", () => {
    expect(actingRoleFor(["arranger", "scas"], "verification.attest")).toBe("scas");
    expect(actingRoleFor(["arranger"], "delivery.lab")).toBe("arranger");
    expect(actingRoleFor(["regulator"], "kyc.decide")).toBeNull();
  });
});

describe("guards", () => {
  const scas = { id: "1", email: "s@example.com", roles: ["scas" as const] };

  it("assertPermission returns the acting role and refuses with 403", () => {
    expect(assertPermission(scas, "verification.attest")).toMatchObject({ actingRole: "scas", permission: "verification.attest" });
    expect(() => assertPermission(scas, "kyc.decide")).toThrow(expect.objectContaining({ status: 403, message: "You do not have permission to decide KYC." }));
  });

  it("assertAccount checks the self-service account kind", () => {
    expect(() => assertAccount({ id: "2", email: "i@example.com", roles: ["investor"] }, "investor")).not.toThrow();
    expect(() => assertAccount(scas, "farmer")).toThrow(expect.objectContaining({ status: 403, message: "This needs an issuer account." }));
  });
});
