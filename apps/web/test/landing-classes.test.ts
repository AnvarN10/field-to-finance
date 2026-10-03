import { describe, expect, it } from "vitest";
import { heroPrimaryCta, heroSecondaryCta, taglineClass } from "../src/components/landing/classes";

describe("landing classes", () => {
  it("hero secondary CTA has a perceptible hover: brighter boundary and a surface fill", () => {
    expect(heroSecondaryCta).toContain("[@media(hover:hover)]:hover:border-muted-foreground");
    expect(heroSecondaryCta).toContain("[@media(hover:hover)]:hover:bg-card");
    expect(heroSecondaryCta).toMatch(/transition-\[[^\]]*\bborder-color\b[^\]]*\]/);
  });

  it("hero primary CTA keeps the wheat hover and transitions scale", () => {
    expect(heroPrimaryCta).toContain("[@media(hover:hover)]:hover:bg-primary-hover");
    expect(heroPrimaryCta).toMatch(/transition-\[[^\]]*\bscale\b[^\]]*\]/);
  });

  it("tagline reads at >= 1.4 line-height on phones and keeps 1.15 from sm", () => {
    const cls = taglineClass.split(" ");
    const phone = cls.find((c) => c.startsWith("leading-"));
    expect(phone).toBeDefined();
    expect(Number(phone!.match(/leading-\[([\d.]+)\]/)![1])).toBeGreaterThanOrEqual(1.4);
    expect(cls).toContain("sm:leading-[1.15]");
  });
});
