import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { explainChainError, extractLogs } from "@/lib/chain/explain";
import { cosignAndSend } from "@/lib/chain/sponsor";
import { TX_ACTIONS } from "@/lib/chain/user-tx";
import { RequestError } from "@/lib/errors";
import { clientIp, createRateLimit, takeAll } from "@/lib/rate-limit";
import { getDb } from "@/lib/server/db";
import { kfdGate } from "@/lib/workflow/investor";
import { getConnection, getReader, getStore, roleKeypair, sponsorPolicy, sponsorPublicKey } from "@/lib/server/context";
import { recordUserTx } from "@/lib/server/tx-history";
import { polygonKey } from "@/lib/store";

export const dynamic = "force-dynamic";

// ADR 0013: every accepted request spends the sponsor's SOL (fee, sometimes rent). Bound the burn rate.
const perIp = createRateLimit({ limit: 20, windowMs: 10 * 60_000 });
const global = createRateLimit({ limit: 300, windowMs: 60 * 60_000 });
// Rent budget for transactions that create accounts at the sponsor's expense (~0.002 SOL each), so a
// wallet cannot close and recreate its token accounts in a loop: 5 per wallet and 60 in total per hour.
const rentPerWallet = createRateLimit({ limit: 5, windowMs: 60 * 60_000 });
const rentGlobal = createRateLimit({ limit: 60, windowMs: 60 * 60_000 });

const Body = z.object({ action: z.enum(TX_ACTIONS), tx: z.string().min(1).max(4_000) });

const fail = (status: number, code: string, title: string, detail: string, logs: string[] = []) =>
  Response.json({ ok: false, error: { code, title, detail, action: "none" }, logs }, { status });

/** Same gate as /api/tx/subscribe, fail closed: no Postgres, no sponsored subscription. */
async function subscribeAllowed(wallet: string, pool: string | null): Promise<void> {
  if (!pool) throw new RequestError("subscribe: pool account is missing", 400);
  let gate;
  try {
    gate = await kfdGate(await getDb(), wallet, pool);
  } catch {
    throw new RequestError("Subscriptions are paused: investor accounts are unavailable right now. Try again in a minute.", 503);
  }
  if (gate === "unlinked") throw new RequestError("Link this wallet in your investor cabinet before subscribing.", 403);
  if (gate === "onboarding") throw new RequestError("Finish investor onboarding (KYC and the risk acknowledgement) before subscribing.", 403);
  if (gate === "kfd") throw new RequestError("Accept this pool's key features document in your investor cabinet before subscribing.", 403);
}

/** Farmer settlement: the program checks the signer too, but the sponsor never co-signs for anyone but the pool's issuer of record. */
async function issuerOfRecord(wallet: string, pool: string | null): Promise<void> {
  const p = pool ? (await getReader().listPools()).find((x) => x.address === pool) : undefined;
  if (!p) throw new RequestError("The pool could not be read. Try again in a minute.", 503);
  if (p.issuer !== wallet) throw new RequestError("Only the issuer of record of this pool can elect its settlement or fund its buyback.", 403);
}

const beforeSignFor = (action: string) =>
  action === "subscribe"
    ? (info: { signer: { toBase58(): string }; summary: { pool: string | null } }) => subscribeAllowed(info.signer.toBase58(), info.summary.pool)
    : action === "elect-settlement" || action === "fund-redemption"
      ? (info: { signer: { toBase58(): string }; summary: { pool: string | null } }) => issuerOfRecord(info.signer.toBase58(), info.summary.pool)
      : undefined;

/** Receives a wallet-signed transaction built by /api/tx/[action], co-signs it as fee payer after validation, submits it. */
export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return fail(400, "BadRequest", "Invalid transaction request", "");
  if (!sponsorPublicKey()) return fail(503, "SponsorUnavailable", "Gas sponsorship is unavailable", "F2F_SPONSOR_KEYPAIR is not set.");
  const wait = takeAll([[perIp, clientIp(req)], [global, "all"]]);
  if (wait > 0) return fail(429, "Cooldown", `Too many transactions. Try again in ${Math.ceil(wait / 60)} min.`, "");
  try {
    const signature = await cosignAndSend(
      {
        policy: await sponsorPolicy(),
        sponsorKey: roleKeypair("sponsor"),
        connection: getConnection(),
        polygonExists: async (hash) => (await getStore().get(polygonKey(hash))) !== null,
        allowRent: (wallet) => takeAll([[rentPerWallet, wallet], [rentGlobal, "all"]]),
        // The KFD gate also lives here: a wallet could build subscribe itself and skip /api/tx/subscribe.
        // Farmer settlement is limited to the pool's issuer of record.
        beforeSign: beforeSignFor(b.data.action),
        // Best effort: the history must never fail a sent transaction.
        onSent: (info, signature) =>
          void recordUserTx({ action: b.data.action, wallet: info.signer.toBase58(), signature, ...info.summary }).catch((e) => Sentry.captureException(e)),
      },
      b.data.action,
      b.data.tx,
    );
    return Response.json({ ok: true, signature });
  } catch (e) {
    if (e instanceof RequestError) return fail(e.status, "SponsorRejected", "The transaction was not accepted", e.message);
    const logs = extractLogs(e);
    if (logs.length > 0) return Response.json({ ok: false, error: explainChainError({ logs, error: e }), logs }, { status: 422 });
    Sentry.captureException(e);
    return fail(502, "SendFailed", "The transaction could not be sent", "Try again in a moment.");
  }
}
