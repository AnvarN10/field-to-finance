import { z } from "zod";
import { explainChainError } from "@/lib/chain/explain";
import { ChainTxError, confirmOrThrow } from "@/lib/chain/send";
import { getConnection, invalidateReads } from "@/lib/server/context";

export const dynamic = "force-dynamic";

const Body = z.object({
  signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/),
  blockhash: z.string().min(32).max(44),
  lastValidBlockHeight: z.number().int().nonnegative(),
});

export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) {
    return Response.json({ ok: false, error: { code: "BadRequest", title: "Invalid confirmation request", detail: "", action: "none" }, logs: [] }, { status: 400 });
  }
  try {
    await confirmOrThrow(getConnection(), b.data.signature, b.data.blockhash, b.data.lastValidBlockHeight);
    return Response.json({ ok: true });
  } catch (e) {
    const logs = e instanceof ChainTxError ? e.logs : [];
    return Response.json({ ok: false, error: explainChainError({ logs, error: e }), logs, signature: b.data.signature }, { status: 422 });
  } finally {
    invalidateReads();
  }
}
