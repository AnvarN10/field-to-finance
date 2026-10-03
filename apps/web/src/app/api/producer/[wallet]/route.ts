import { RequestError } from "@/lib/errors";
import { getReader } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await ctx.params;
  try {
    const reader = getReader();
    const [projects, pools] = await Promise.all([reader.projectsByProducer(wallet), reader.listPools()]);
    const byAddress = new Map(pools.map((p) => [p.address, p]));
    return Response.json({
      projects: projects.map((p) => {
        const pool = p.pool ? byAddress.get(p.pool) : undefined;
        return { ...p, poolId: pool?.poolId ?? null, poolStatus: pool?.status ?? null, symbol: pool?.instrument?.symbol ?? null };
      }),
    });
  } catch (e) {
    if (e instanceof RequestError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
