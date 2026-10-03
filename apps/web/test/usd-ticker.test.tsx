// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UsdTicker } from "../src/components/landing/usd-ticker";

function stubMatchMedia(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
}

let observed: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
class IO {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    observed = cb;
  }
  observe() {}
  disconnect() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  observed = null;
});

const visible = (c: HTMLElement) => c.querySelector("[aria-hidden]")?.textContent;

describe("UsdTicker", () => {
  it("shows the final value and never moves when the viewer prefers reduced motion", () => {
    stubMatchMedia(true);
    vi.stubGlobal("IntersectionObserver", IO);
    const { container } = render(<UsdTicker value="2250000000" cents={false} />);
    expect(visible(container)).toBe("$2,250");
    expect(observed).toBeNull();
  });

  it("counts from zero once in view and ends on the exact final value", async () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", IO);
    // Every frame lands after the 900ms duration, so one frame finishes the count.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now() + 1000), 0) as unknown as number);
    const { container } = render(<UsdTicker value="2250000000" cents={false} />);
    expect(visible(container)).toBe("$0");
    await act(async () => {
      observed?.([{ isIntersecting: true }]);
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(visible(container)).toBe("$2,250");
  });

  it("gives screen readers the final value only", () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", IO);
    render(<UsdTicker value="500000000" />);
    expect(screen.getByText("$500.00", { selector: ".sr-only" })).toBeInTheDocument();
  });
});
