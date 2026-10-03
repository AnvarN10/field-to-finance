import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// With a src/ folder Next only loads instrumentation files from src/ (next/dist/docs/01-app/02-guides/instrumentation.md);
// at the app root they are ignored by the standalone server, so GlitchTip, PostHog and the boot key check silently never run.
describe("instrumentation files", () => {
  it("live in src/ next to app/", () => {
    const web = join(__dirname, "..");
    expect(existsSync(join(web, "src/instrumentation.ts"))).toBe(true);
    expect(existsSync(join(web, "src/instrumentation-client.ts"))).toBe(true);
    expect(existsSync(join(web, "instrumentation.ts"))).toBe(false);
    expect(existsSync(join(web, "instrumentation-client.ts"))).toBe(false);
  });
});
