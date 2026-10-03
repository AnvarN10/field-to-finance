import { PublicKey } from "@solana/web3.js";
import { approveInvestor } from "@/lib/chain/admin-ops";
import { explainChainError } from "@/lib/chain/explain";
import { ChainTxError } from "@/lib/chain/send";
import { RequestError } from "@/lib/errors";
import { kycFormSchema } from "@/lib/kyc";
import { clientIp, createRateLimit, takeAll } from "@/lib/rate-limit";
import { getReader, opsContext } from "@/lib/server/context";

export const dynamic = "force-dynamic";

// Each approval pays InvestorRecord rent from the compliance key; cap fresh-wallet loops.
const perIp = createRateLimit({ limit: 5, windowMs: 10 * 60_000 });
const global = createRateLimit({ limit: 60, windowMs: 60 * 60_000 });

export async function POST(req: Request) {
  const parsed = kycFormSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Field paths only: never echo submitted values.
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return Response.json({ ok: false, error: { code: "BadRequest", title: "Check the form", detail, action: "none" } }, { status: 400 });
  }
  const wait = takeAll([[perIp, clientIp(req)], [global, "all"]]);
  if (wait > 0) {
    return Response.json({ ok: false, error: { code: "Cooldown", title: `Too many KYC requests. Try again in ${Math.ceil(wait / 60)} min.`, detail: "", action: "none" } }, { status: 429 });
  }
  try {
    // Approval is platform-level and permanent until revoked: a repeat costs nothing.
    if ((await getReader().investor(parsed.data.wallet)).approved) return Response.json({ ok: true, signature: null });
    const signature = await approveInvestor(opsContext(), new PublicKey(parsed.data.wallet));
    return Response.json({ ok: true, signature });
  } catch (e) {
    if (e instanceof RequestError) {
      return Response.json({ ok: false, error: { code: "BadRequest", title: e.message, detail: "", action: "none" } }, { status: e.status });
    }
    const logs = e instanceof ChainTxError ? e.logs : [];
    return Response.json({ ok: false, error: explainChainError({ logs, error: e }), logs }, { status: 422 });
  }
}
