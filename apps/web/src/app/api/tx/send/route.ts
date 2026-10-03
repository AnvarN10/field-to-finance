import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { explainChainError, extractLogs } from "@/lib/chain/explain";
import { cosignAndSend } from "@/lib/chain/sponsor";
import { TX_ACTIONS } from "@/lib/chain/user-tx";
import { RequestError } from "@/lib/errors";
import { clientIp, createRateLimit, takeAll } from "@/lib/rate-limit";
import { getConnection, roleKeypair, sponsorPolicy, sponsorPublicKey } from "@/lib/server/context";

export const dynamic = "force-dynamic";

// ADR 0013: every accepted request spends the sponsor's SOL (fee, sometimes rent). Bound the burn rate.
const perIp = createRateLimit({ limit: 20, windowMs: 10 * 60_000 });
const global = createRateLimit({ limit: 300, windowMs: 60 * 60_000 });

const Body = z.object({ action: z.enum(TX_ACTIONS), tx: z.string().min(1).max(4_000) });

const fail = (status: number, code: string, title: string, detail: string, logs: string[] = []) =>
  Response.json({ ok: false, error: { code, title, detail, action: "none" }, logs }, { status });

/** Receives a wallet-signed transaction built by /api/tx/[action], co-signs it as fee payer after validation, submits it. */
export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return fail(400, "BadRequest", "Invalid transaction request", "");
  if (!sponsorPublicKey()) return fail(503, "SponsorUnavailable", "Gas sponsorship is unavailable", "F2F_SPONSOR_KEYPAIR is not set.");
  const wait = takeAll([[perIp, clientIp(req)], [global, "all"]]);
  if (wait > 0) return fail(429, "Cooldown", `Too many transactions. Try again in ${Math.ceil(wait / 60)} min.`, "");
  try {
    const signature = await cosignAndSend(
      { policy: await sponsorPolicy(), sponsorKey: roleKeypair("sponsor"), connection: getConnection() },
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
