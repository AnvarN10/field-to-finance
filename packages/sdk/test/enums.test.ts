import { describe, expect, it } from "vitest";
import { kindFromAnchor, parseKind, toAnchorEnum, verdictFromAnchor } from "../src/enums";

describe("enum mapping", () => {
  it("maps names to Anchor enum arguments", () => {
    expect(toAnchorEnum("FieldVerified")).toEqual({ fieldVerified: {} });
    expect(toAnchorEnum("InsufficientData")).toEqual({ insufficientData: {} });
  });

  it("maps decoded Anchor enums back to names", () => {
    expect(kindFromAnchor({ harvest: {} })).toBe("Harvest");
    expect(verdictFromAnchor({ pass: {} })).toBe("Pass");
    expect(() => verdictFromAnchor({ maybe: {} })).toThrow(/unknown enum variant/);
  });

  it("parses CLI spellings of kinds", () => {
    expect(parseKind("field-verified")).toBe("FieldVerified");
    expect(parseKind("VEGETATION")).toBe("Vegetation");
    expect(() => parseKind("rain")).toThrow(/expected one of/);
  });
});
