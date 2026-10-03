// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("LandingMotion", () => {
  it("leaves the page in its end state when the viewer prefers reduced motion", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q === "(prefers-reduced-motion: reduce)",
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }));
    const { LandingMotion } = await import("../src/components/landing/landing-motion");
    const { container } = render(
      <LandingMotion>
        <p data-reveal>Reveal</p>
        <p data-tagline>
          <span data-tagline-word>Seed</span>
        </p>
      </LandingMotion>,
    );
    expect(container.querySelector<HTMLElement>("[data-reveal]")!.style.opacity).toBe("");
    expect(container.querySelector<HTMLElement>("[data-tagline-word]")!.style.opacity).toBe("");
  });
});

describe("LandingMotion with motion allowed", () => {
  it("hides reveal blocks until they scroll into view", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("no-preference"),
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }));
    vi.resetModules();
    const { LandingMotion } = await import("../src/components/landing/landing-motion");
    const { container } = render(
      <LandingMotion>
        <p data-reveal>Reveal</p>
        <p data-tagline>
          <span data-tagline-word>Seed</span>
        </p>
      </LandingMotion>,
    );
    // jsdom has no layout, so scrubbed tweens resolve to their end; the once-on-enter reveal still starts hidden.
    expect(container.querySelector<HTMLElement>("[data-reveal]")!.style.opacity).toBe("0");
  });
});
