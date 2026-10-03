import { getStore } from "@/lib/server/context";
import { evidenceKey, serveHashed } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ hash: string }> }) {
  const { hash } = await ctx.params;
  return serveHashed(getStore(), evidenceKey(hash), hash);
}
