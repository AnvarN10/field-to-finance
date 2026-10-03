import { defineConfig } from "tsup";

// One CommonJS bundle. The sdk is TypeScript source in the workspace, so it is
// bundled together with its own dependency; everything else stays in node_modules.
export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: ["@f2f/sdk", "@noble/hashes"],
});
