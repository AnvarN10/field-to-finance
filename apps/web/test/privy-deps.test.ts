import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Privy lists its Solana helpers as optional peers; a missing one only shows up when the
// farmer page is bundled ("Module not found: @solana-program/memo"), so check them here.
describe("Privy Solana peer dependencies", () => {
  it("resolves every package that @privy-io/react-auth/solana imports", () => {
    const require = createRequire(join(__dirname, "..", "package.json"));
    const entry = require.resolve("@privy-io/react-auth");
    const privyDir = entry.slice(0, entry.indexOf("/@privy-io/react-auth/") + "/@privy-io/react-auth".length);
    const src = readFileSync(join(privyDir, "dist", "esm", "solana.mjs"), "utf8");
    const privyRequire = createRequire(join(privyDir, "package.json"));
    const specifiers = [...new Set([...src.matchAll(/from"(@solana[^"/]*\/[^"/]+)"/g)].map((m) => m[1] as string))];
    expect(specifiers).toContain("@solana-program/memo");
    for (const s of specifiers) {
      const found = (privyRequire.resolve.paths(s) ?? []).some((dir) => existsSync(join(dir, s, "package.json")));
      expect(found, s).toBe(true);
    }
  });
});
