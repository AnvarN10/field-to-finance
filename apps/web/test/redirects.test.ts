import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { LEGACY_REDIRECTS, resolveLegacy } from "../src/lib/redirects";

describe("legacy cabinet redirects", () => {
  it.each([
    ["/admin", "/console"],
    ["/arranger", "/console"],
    ["/arranger/applications/0f0e", "/console/applications/0f0e"],
    ["/arranger/investors", "/console/investors"],
    ["/arranger/pools", "/console/pools"],
    ["/arranger/pools/8", "/console/pools/8"],
    ["/arranger/roles", "/console/team"],
    ["/arranger/audit", "/console/audit"],
    ["/arranger/treasury", "/console/settings"],
    ["/compliance", "/console/issuers"],
    ["/compliance/investors", "/console/investors"],
    ["/compliance/limits", "/console/investors/limits"],
    ["/scas", "/console/verification"],
    ["/scas/pools/9", "/console/verification/pools/9"],
    ["/elevator", "/console/delivery"],
    ["/regulator", "/console/registry"],
    ["/regulator/pools/9", "/console/registry/pools/9"],
    ["/regulator/events", "/console/registry/events"],
    ["/investor", "/invest"],
    ["/portfolio", "/invest"],
    ["/investor/onboarding", "/invest/account"],
    ["/investor/pools/7", "/invest/pools/7"],
    ["/farmer", "/issuer"],
    ["/farmer/onboarding", "/issuer/company"],
    ["/farmer/applications", "/issuer/applications"],
    ["/farmer/applications/new", "/issuer/applications/new"],
    ["/farmer/applications/a1", "/issuer/applications/a1"],
  ])("%s → %s", (from, to) => {
    expect(resolveLegacy(from)).toBe(to);
  });

  it("leaves new and public paths alone", () => {
    for (const p of ["/", "/pools/7", "/console", "/invest", "/issuer/applications", "/farmers-market", "/investors"]) expect(resolveLegacy(p)).toBeNull();
  });

  it("next.config serves the same table as temporary redirects", async () => {
    const r = await nextConfig.redirects!();
    expect(r).toEqual(LEGACY_REDIRECTS.map((x) => ({ ...x, permanent: false })));
  });
});
