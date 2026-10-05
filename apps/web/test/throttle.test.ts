import { describe, expect, it } from "vitest";
import { createThrottle } from "../src/lib/throttle";

describe("createThrottle", () => {
  it("allows one run per window and always allows a forced run", () => {
    let now = 0;
    const t = createThrottle(30_000, () => now);
    expect(t.take()).toBe(true);
    expect(t.take()).toBe(false);
    expect(t.take(true)).toBe(true);
    now = 10_000;
    expect(t.take()).toBe(false);
    now = 31_000;
    expect(t.take()).toBe(true);
    now = 40_000;
    expect(t.take()).toBe(false);
  });
});
