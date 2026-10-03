// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DealPath } from "../src/components/landing/deal-path";
import { PoolStatusBadge } from "../src/components/status-badge";
import { TxStatus } from "../src/components/tx/tx-status";
import { buttonVariants } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { Textarea } from "../src/components/ui/textarea";

const SRC = join(__dirname, "../src");
const css = readFileSync(join(SRC, "app/globals.css"), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(tsx?|css)$/.test(name) ? [p] : [];
  });
}

describe("single dark theme: no dormant dark: overrides", () => {
  it("no component source uses a dark: variant (the app has one theme; <html class=dark> would activate shadcn's alternates)", () => {
    const offenders = sourceFiles(SRC)
      .filter((p) => !p.endsWith(".css"))
      .filter((p) => /\bdark:/.test(readFileSync(p, "utf8")))
      .map((p) => p.slice(SRC.length + 1));
    expect(offenders).toEqual([]);
  });

  it.each([
    ["Input", () => render(<Input aria-label="field" aria-invalid disabled />)],
    ["Textarea", () => render(<Textarea aria-label="field" aria-invalid disabled />)],
  ])("%s shows the invalid state in full --destructive and disables like the dashed-outline Button", (_, mount) => {
    mount();
    const el = screen.getByLabelText("field");
    const cls = el.className.split(" ");
    expect(cls).toContain("aria-invalid:border-destructive");
    expect(cls.some((c) => c.startsWith("aria-invalid:border-destructive/"))).toBe(false);
    expect(cls).toEqual(expect.arrayContaining(["disabled:border-dashed", "disabled:bg-transparent", "disabled:text-muted-foreground"]));
    expect(cls).not.toContain("disabled:opacity-50");
  });
});

describe("status colours", () => {
  it("Refunding is neutral like Draft, with its own icon", () => {
    const { container } = render(<PoolStatusBadge status="Refunding" />);
    const badge = container.firstElementChild!;
    expect(badge.className).toContain("border-border");
    expect(badge.className).toContain("text-muted-foreground");
    expect(badge.className).not.toMatch(/warning/);
    expect(badge.querySelector("svg")?.getAttribute("class")).toContain("lucide-rotate-ccw");
  });

  it("no warning colour aliases the wheat brand colour", () => {
    expect(css).not.toMatch(/--color-warning/);
    const users = sourceFiles(SRC).filter((p) => /\b(text|bg|border)-warning\b/.test(readFileSync(p, "utf8")));
    expect(users).toEqual([]);
  });
});

describe("perceptible hover on quiet buttons", () => {
  it("defines a hover surface token measured against raised (style-lock Color contract)", () => {
    expect(css).toMatch(/--hover:\s*#323833/);
    expect(css).toMatch(/--color-hover:\s*var\(--hover\)/);
  });

  it("outline hover brightens the boundary and lifts the fill", () => {
    const cls = buttonVariants({ variant: "outline" });
    expect(cls).toContain("hover:border-muted-foreground");
    expect(cls).toContain("hover:bg-muted");
  });

  it.each(["ghost", "secondary"] as const)("%s hover uses the hover token", (variant) => {
    const cls = buttonVariants({ variant });
    expect(cls).toContain("hover:bg-hover");
    expect(cls).toContain("hover:text-foreground");
  });
});

describe("press scale is transitioned", () => {
  it("Button transitions the scale property that active:scale-[0.98] sets", () => {
    expect(buttonVariants()).toMatch(/transition-\[[^\]]*\bscale\b[^\]]*\]/);
  });

  it("the TxStatus action button transitions scale", () => {
    render(<TxStatus state={{ phase: "error", error: { code: "NoSol", title: "t", detail: "d", action: "faucet" }, logs: [] }} onAction={() => {}} />);
    expect(screen.getByRole("button", { name: "Get test funds" }).className).toMatch(/transition-\[[^\]]*\bscale\b[^\]]*\]/);
  });
});

describe("deal path rail", () => {
  it("the ordered list contains only list items; the decorative track and fill sit in the rail wrapper", () => {
    const { container } = render(<DealPath />);
    const ol = container.querySelector("ol")!;
    expect(Array.from(ol.children).map((c) => c.tagName)).toEqual(Array(7).fill("LI"));
    const rail = container.querySelector("[data-rail]")!;
    const fill = rail.querySelector("[data-rail-fill]");
    expect(fill).not.toBeNull();
    expect(ol.contains(fill)).toBe(false);
  });
});
