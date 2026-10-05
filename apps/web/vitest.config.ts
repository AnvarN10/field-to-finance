import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": here("./src"),
      // The real package throws outside React Server Components.
      "server-only": here("./test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["test/setup.ts"],
    // PGlite workflow walks migrate a fresh database per test; under a full parallel run they can pass 5 s.
    testTimeout: 15_000,
  },
});
