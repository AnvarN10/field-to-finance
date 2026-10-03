import { describe, expect, it } from "vitest";
import { firstInvalid, validateRegistration } from "../src/lib/register-form";

describe("validateRegistration", () => {
  it("passes a complete form and returns the converted values", () => {
    const r = validateRegistration({ fieldCount: 2, tonnes: "400", usd: "2000", declaredHa: ["55.99", "47.2"] });
    expect(r.errors).toEqual({});
    expect(r.values).toEqual({ expectedKg: "400000", requestedAmount: "2000000000", areaHaX100: [5599, 4720] });
  });

  it("puts each problem on its own field", () => {
    const r = validateRegistration({ fieldCount: 2, tonnes: "0", usd: "abc", declaredHa: ["10", ""] });
    expect(r.values).toBeNull();
    expect(r.errors.tonnes).toBe("Enter the expected harvest in tonnes.");
    expect(r.errors.usd).toBeTruthy();
    expect(r.errors.declared).toEqual([undefined, "Enter an area above 0 ha."]);
    expect(r.errors.upload).toBeUndefined();
  });

  it("asks for boundaries before anything else", () => {
    const r = validateRegistration({ fieldCount: 0, tonnes: "400", usd: "2000", declaredHa: [] });
    expect(r.errors.upload).toBe("Upload your field boundaries first.");
  });

  it("names the first invalid control in form order", () => {
    expect(firstInvalid({ usd: "x", tonnes: "y" })).toBe("tonnes");
    expect(firstInvalid({ usd: "x", declared: [undefined, "z"] })).toBe("declared-1");
    expect(firstInvalid({})).toBeNull();
  });
});
