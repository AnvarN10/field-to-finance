import * as Sentry from "@sentry/nextjs";
import { toCsv } from "@/lib/csv";
import { RequestError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { regulatorData, regulatorEvents } from "@/lib/server/regulator-data";

export const dynamic = "force-dynamic";

const usd = (base: string) => (Number(BigInt(base)) / 1_000_000).toFixed(2);
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { "cache-control": "private, no-store" } });

/** Final report of one pool for the arranger: the registry entry, the holders and every event, in one CSV. */
export async function GET(_req: Request, ctx: { params: Promise<{ poolId: string }> }) {
  try {
    await requirePermission("pools.view");
  } catch (e) {
    return fail(e instanceof RequestError ? e.status : 503, e instanceof Error ? e.message : "unavailable");
  }
  const { poolId } = await ctx.params;
  if (!/^\d{1,20}$/.test(poolId)) return fail(400, "invalid pool id");
  try {
    const db = await getDb();
    const [d, events] = [await regulatorData(db, { poolId }), await regulatorEvents(db, poolId)];
    const r = d.registry[0];
    if (!r) return fail(404, "pool not found");
    const csv = [
      toCsv(["Pool", "Symbol", "Status", "Issuer wallet", "Issuer legal name", "Issuer BIN", "Raised (USD)", "Target (USD)", "Coupon (bps)", "Settlement", "Maturity (UTC)", "Holders", "Holders complete"], [[r.poolId, r.symbol, r.status, r.issuerWallet, r.issuerLegalName, r.issuerBin, usd(r.raised), usd(r.target), r.couponBps, r.settlementMode, new Date(r.maturityTs * 1000).toISOString(), r.holders, r.holders === null ? "unknown" : r.holdersComplete ? "yes" : "no"]]),
      toCsv(["Holder wallet", "Balance (USD)", "Category", "IIN"], d.holders.map((h) => [h.wallet, usd(h.balance), h.category, h.iin])),
      toCsv(["Time (UTC)", "Action", "Acting role", "Target type", "Target", "Transaction", "Detail"], events.map((e) => [e.at, e.action, e.actingRole, e.targetType, e.targetId, e.signature, e.detail])),
    ].join("\r\n");
    return new Response(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="f2f-pool-${poolId}-report.csv"`, "cache-control": "private, no-store" } });
  } catch (e) {
    Sentry.captureException(e);
    return fail(503, "The report could not be built. Try again in a minute.");
  }
}
