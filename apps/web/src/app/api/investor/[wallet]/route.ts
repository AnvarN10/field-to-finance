import { RequestError } from "@/lib/errors";
import { getReader } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await ctx.params;
  try {
    return Response.json(await getReader().investor(wallet));
  } catch (e) {
    if (e instanceof RequestError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
