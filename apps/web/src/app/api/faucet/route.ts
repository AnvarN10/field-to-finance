import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { runFaucet } from "@/lib/chain/faucet";
import { RequestError } from "@/lib/errors";
import { clientIp, createRateLimit, takeAll } from "@/lib/rate-limit";
import { faucetDeps } from "@/lib/server/context";

export const dynamic = "force-dynamic";
// Per wallet the faucet already cools down for 60 s; these stop fresh-wallet loops from draining the deployer.
const perIp = createRateLimit({ limit: 3, windowMs: 10 * 60_000 });
const global = createRateLimit({ limit: 30, windowMs: 60 * 60_000 });
const Body = z.object({ wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/), usdc: z.boolean() });

export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ ok: false, error: { code: "BadRequest", title: "Connect a wallet first", detail: "", action: "none" } }, { status: 400 });
  const wait = takeAll([[perIp, clientIp(req)], [global, "all"]]);
  if (wait > 0) {
    return Response.json({ ok: false, error: { code: "Cooldown", title: `The faucet is busy. Try again in ${Math.ceil(wait / 60)} min.`, detail: "", action: "none" } }, { status: 429 });
  }
  try {
    return Response.json({ ok: true, ...(await runFaucet(faucetDeps(), new PublicKey(b.data.wallet), { usdc: b.data.usdc })) });
  } catch (e) {
    if (e instanceof RequestError) return Response.json({ ok: false, error: { code: "Cooldown", title: e.message, detail: "", action: "none" } }, { status: e.status });
    return Response.json({ ok: false, error: { code: "FaucetFailed", title: "The faucet could not send funds", detail: "Try again in a minute.", action: "retry" } }, { status: 502 });
  }
}
