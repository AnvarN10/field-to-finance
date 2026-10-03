import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { runFaucet } from "@/lib/chain/faucet";
import { RequestError } from "@/lib/errors";
import { faucetDeps } from "@/lib/server/context";

export const dynamic = "force-dynamic";
const Body = z.object({ wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/), usdc: z.boolean() });

export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ ok: false, error: { code: "BadRequest", title: "Connect a wallet first", detail: "", action: "none" } }, { status: 400 });
  try {
    return Response.json({ ok: true, ...(await runFaucet(faucetDeps(), new PublicKey(b.data.wallet), { usdc: b.data.usdc })) });
  } catch (e) {
    if (e instanceof RequestError) return Response.json({ ok: false, error: { code: "Cooldown", title: e.message, detail: "", action: "none" } }, { status: e.status });
    return Response.json({ ok: false, error: { code: "FaucetFailed", title: "The faucet could not send funds", detail: "Try again in a minute.", action: "retry" } }, { status: 502 });
  }
}
