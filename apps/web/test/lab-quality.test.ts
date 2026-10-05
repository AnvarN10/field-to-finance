import { PILOT_QUALITY_SPEC } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import { evaluateLab, parseRequirement } from "../src/lib/lab-quality";

const good = { crop: "Wheat", class: "HiPro (class 3)", gluten: "31", protein: "15.2", moisture: "13.5", falling_number: "250", test_weight: "760", impurities: "1.5", odour: "None", gluten_deformation_index: "70", vitreousness: "55", pests: "None" };

describe("lab quality", () => {
  it("parses the twelve pilot requirements", () => {
    expect(parseRequirement("≥ 30%")).toEqual({ op: "min", value: 30, unit: "%" });
    expect(parseRequirement("≤ 2%")).toEqual({ op: "max", value: 2, unit: "%" });
    expect(parseRequirement("14% (12%)")).toEqual({ op: "max", value: 14, unit: "%" });
    expect(parseRequirement("≥ 750 g/l")).toEqual({ op: "min", value: 750, unit: "g/l" });
    expect(parseRequirement("≤ 75 units")).toEqual({ op: "max", value: 75, unit: "units" });
    expect(parseRequirement("None")).toEqual({ op: "text", expected: "none" });
    expect(parseRequirement("HiPro (class 3)")).toEqual({ op: "text", expected: "hipro (class 3)" });
  });

  it("passes a protocol inside the spec, boundaries included", () => {
    const r = evaluateLab(PILOT_QUALITY_SPEC, { ...good, gluten: "30", impurities: "2" });
    expect(r.verdict).toBe("Pass");
    expect(r.results).toHaveLength(12);
    expect(r.results.every((x) => x.pass)).toBe(true);
  });

  it("fails one parameter out of spec; text compares case-insensitively", () => {
    const r = evaluateLab(PILOT_QUALITY_SPEC, { ...good, protein: "14.9", odour: "none" });
    expect(r.verdict).toBe("Fail");
    expect(r.results.find((x) => x.key === "protein")?.pass).toBe(false);
    expect(r.results.find((x) => x.key === "odour")?.pass).toBe(true);
  });

  it("accepts a decimal comma", () => {
    expect(evaluateLab(PILOT_QUALITY_SPEC, { ...good, protein: "15,2" }).verdict).toBe("Pass");
  });

  it("missing or unreadable measurements are insufficient data unless something fails", () => {
    const { gluten: _, ...rest } = good;
    expect(evaluateLab(PILOT_QUALITY_SPEC, rest).verdict).toBe("InsufficientData");
    expect(evaluateLab(PILOT_QUALITY_SPEC, { ...good, gluten: "abc" }).verdict).toBe("InsufficientData");
    expect(evaluateLab(PILOT_QUALITY_SPEC, { ...good, gluten: "abc", protein: "10" }).verdict).toBe("Fail");
  });
});
