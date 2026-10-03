import path from "node:path";
import type { NextConfig } from "next";

// Nx runs next from apps/web, so the monorepo root is two levels up.
const root = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  turbopack: { root },
  // @f2f/sdk ships TypeScript source.
  transpilePackages: ["@f2f/sdk"],
  // Anchor is CommonJS and server-only; load it with Node's require at runtime.
  serverExternalPackages: ["@anchor-lang/core"],
  poweredByHeader: false,
};

export default nextConfig;
