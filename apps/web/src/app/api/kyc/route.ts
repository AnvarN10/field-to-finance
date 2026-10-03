import { PublicKey } from "@solana/web3.js";
import { approveInvestor } from "@/lib/chain/admin-ops";
import { explainChainError } from "@/lib/chain/explain";
import { ChainTxError } from "@/lib/chain/send";
import { RequestError } from "@/lib/errors";
import { kycFormSchema } from "@/lib/kyc";
import { opsContext } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = kycFormSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Field paths only: never echo submitted values.
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return Response.json({ ok: false, error: { code: "BadRequest", title: "Check the form", detail, action: "none" } }, { status: 400 });
  }
  try {
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
