import * as Sentry from "@sentry/nextjs";
import { explainChainError } from "@/lib/chain/explain";
import { buildV0, bytesToBase64, simulate } from "@/lib/chain/send";
import { TX_ACTIONS, buildUserTx, type TxAction } from "@/lib/chain/user-tx";
import { RequestError } from "@/lib/errors";
import { getDb } from "@/lib/server/db";
import { kfdGate, type KfdGate } from "@/lib/workflow/investor";
import { getBuildProgram, getConnection, getReader, getStore, getUsdcMint, sponsorPublicKey } from "@/lib/server/context";

export const dynamic = "force-dynamic";

const GATE: Record<Exclude<KfdGate, null>, [code: string, title: string, detail: string, action: "onboarding" | "kfd"]> = {
  unlinked: ["WalletNotLinked", "Link this wallet in your investor cabinet", "Sign in, finish onboarding and link this wallet before subscribing.", "onboarding"],
  onboarding: ["OnboardingIncomplete", "Finish investor onboarding first", "KYC approval and the risk acknowledgement come before any subscription.", "onboarding"],
  kfd: ["KfdRequired", "Accept this pool's key features document", "Read the key features in your investor cabinet; accepting takes one click.", "kfd"],
};

/** Spec 2026-10-05: an investor accepts the pool's key features document before the first subscription. */
async function subscribeGate(body: unknown): Promise<Response | null> {
  const b = body as { signer?: unknown; poolId?: unknown } | null;
  if (typeof b?.signer !== "string" || typeof b.poolId !== "string") return null; // buildUserTx reports the malformed body
  const detail = await getReader().getPool(b.poolId).catch(() => null);
  if (!detail) return null;
  let gate: KfdGate;
  try {
    gate = await kfdGate(await getDb(), b.signer, detail.pool.address);
  } catch {
    return fail(503, "AccountsUnavailable", "Subscriptions are paused", "Investor accounts are unavailable right now. Try again in a minute.");
  }
  if (!gate) return null;
  const [code, title, detailText, action] = GATE[gate];
  return Response.json({ ok: false, error: { code, title, detail: detailText, action }, logs: [] }, { status: 403 });
}

const fail = (status: number, code: string, title: string, detail: string) =>
  Response.json({ ok: false, error: { code, title, detail, action: "none" }, logs: [] }, { status });

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (!(TX_ACTIONS as readonly string[]).includes(action)) return fail(404, "UnknownAction", "Unknown action", action);
  const body = await req.json().catch(() => null);
  if (action === "subscribe") {
    const refused = await subscribeGate(body);
    if (refused) return refused;
  }
  try {
    const built = await buildUserTx(
      {
        program: getBuildProgram(),
        store: getStore(),
        usdcMint: getUsdcMint(),
        sponsor: sponsorPublicKey(),
        getFees: () => getReader().fees(),
        getPool: async (id) => (await getReader().getPool(id))?.pool ?? null,
      },
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
    if (e instanceof RequestError) return fail(e.status, e.status === 503 ? "SponsorUnavailable" : "BadRequest", e.status === 503 ? "Gas sponsorship is unavailable" : "Check the form", e.message);
    Sentry.captureException(e);
    return fail(500, "ServerError", "The server could not build this transaction", "Try again in a moment.");
  }
}
