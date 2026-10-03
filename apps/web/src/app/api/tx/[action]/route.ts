import * as Sentry from "@sentry/nextjs";
import { explainChainError } from "@/lib/chain/explain";
import { buildV0, bytesToBase64, simulate } from "@/lib/chain/send";
import { TX_ACTIONS, buildUserTx, type TxAction } from "@/lib/chain/user-tx";
import { RequestError } from "@/lib/errors";
import { getBuildProgram, getConnection, getReader, getStore, getUsdcMint } from "@/lib/server/context";

export const dynamic = "force-dynamic";

const fail = (status: number, code: string, title: string, detail: string) =>
  Response.json({ ok: false, error: { code, title, detail, action: "none" }, logs: [] }, { status });

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (!(TX_ACTIONS as readonly string[]).includes(action)) return fail(404, "UnknownAction", "Unknown action", action);
  const body = await req.json().catch(() => null);
  try {
    const built = await buildUserTx(
      { program: getBuildProgram(), store: getStore(), usdcMint: getUsdcMint(), getPool: async (id) => (await getReader().getPool(id))?.pool ?? null },
      action as TxAction,
      body,
    );
    const connection = getConnection();
    const { tx, blockhash, lastValidBlockHeight } = await buildV0(connection, built.payer, built.instructions);
    const sim = await simulate(connection, tx);
    if (sim.err) {
      return Response.json({ ok: false, error: explainChainError({ logs: sim.logs, error: sim.err }), logs: sim.logs }, { status: 422 });
    }
    return Response.json({ ok: true, tx: bytesToBase64(tx.serialize()), blockhash, lastValidBlockHeight, meta: built.meta });
  } catch (e) {
    if (e instanceof RequestError) return fail(e.status, "BadRequest", "Check the form", e.message);
    Sentry.captureException(e);
    return fail(500, "ServerError", "The server could not build this transaction", "Try again in a moment.");
  }
}
