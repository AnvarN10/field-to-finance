import { getReader } from "@/lib/server/context";
import { serverEnv } from "@/lib/server/env";

export async function GET(_req: Request, ctx: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await ctx.params;
  const detail = await getReader().getPool(poolId).catch(() => null);
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({
    name: detail.pool.instrument?.name ?? `Pool ${poolId}`,
    symbol: detail.pool.instrument?.symbol ?? "",
    description: `Field-to-Finance pool ${poolId}: ${detail.pool.crop} ${detail.pool.season}, fixed yield. Devnet demo.`,
    external_url: `${serverEnv().PUBLIC_BASE_URL}/pools/${poolId}`,
  });
}
