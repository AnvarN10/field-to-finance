import { serverEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";

// Railway healthcheck. Deliberately does not call devnet: an RPC hiccup must not restart the service.
export function GET() {
  return Response.json({
    ok: true,
    version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    cluster: serverEnv().SOLANA_CLUSTER,
  });
}
