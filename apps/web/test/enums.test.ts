import { describe, expect, it } from "vitest";
import { poolStatusFromAnchor, SETTLEMENT_LABELS, SETTLEMENT_RULES, settlementFromAnchor } from "../src/lib/chain/enums";

describe("program enums", () => {
  it("maps Anchor enum objects to names", () => {
    expect(poolStatusFromAnchor({ open: {} })).toBe("Open");
    expect(poolStatusFromAnchor({ redeeming: {} })).toBe("Redeeming");
    expect(settlementFromAnchor({ coveredFromOtherFields: {} })).toBe("CoveredFromOtherFields");
  });

  it("rejects unknown variants", () => {
    expect(() => poolStatusFromAnchor({ closed: {} })).toThrow(/unknown/);
    expect(() => poolStatusFromAnchor(null)).toThrow();
  });

  it("has a label for every settlement rule", () => {
    for (const r of SETTLEMENT_RULES) expect(SETTLEMENT_LABELS[r]).toMatch(/\w/);
  });
});
