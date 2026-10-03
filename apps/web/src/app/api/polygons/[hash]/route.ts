import { getStore } from "@/lib/server/context";
import { polygonKey, serveHashed } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ hash: string }> }) {
  const { hash } = await ctx.params;
  return serveHashed(getStore(), polygonKey(hash), hash);
}
