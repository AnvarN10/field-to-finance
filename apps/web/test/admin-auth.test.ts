import { describe, expect, it } from "vitest";
import { adminToken, isAdminToken, passwordMatches } from "../src/lib/admin-auth";

describe("admin auth", () => {
  it("derives a stable token that does not contain the password", () => {
    const t = adminToken("correct horse");
    expect(t).toBe(adminToken("correct horse"));
    expect(t).not.toContain("correct");
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accepts only the matching token and only when a password is configured", () => {
    expect(isAdminToken("correct horse", adminToken("correct horse"))).toBe(true);
    expect(isAdminToken("correct horse", adminToken("wrong"))).toBe(false);
    expect(isAdminToken(undefined, adminToken("x"))).toBe(false);
    expect(isAdminToken("correct horse", undefined)).toBe(false);
  });

  it("compares passwords without length leaks", () => {
    expect(passwordMatches("correct horse", "correct horse")).toBe(true);
    expect(passwordMatches("correct horse", "c")).toBe(false);
  });
});
