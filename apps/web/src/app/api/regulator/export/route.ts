import * as Sentry from "@sentry/nextjs";
import { toCsv } from "@/lib/csv";
import { RequestError } from "@/lib/errors";
import { requireServiceAction } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { regulatorData, regulatorEvents } from "@/lib/server/regulator-data";

export const dynamic = "force-dynamic";

const KINDS = ["registry", "holders", "events"] as const;
const usd = (base: string) => (Number(BigInt(base)) / 1_000_000).toFixed(2);
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { "cache-control": "private, no-store" } });

/** CSV export for the regulator (and arrangers): registry, holders or events, with the same filters as the cabinet. */
export async function GET(req: Request) {
  try {
    await requireServiceAction("regulator");
  } catch (e) {
    return fail(e instanceof RequestError ? e.status : 503, e instanceof Error ? e.message : "unavailable");
  }
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind") ?? "";
  if (!(KINDS as readonly string[]).includes(kind)) return fail(400, "kind must be registry, holders or events");
  const opt = (k: string) => q.get(k)?.trim() || undefined;
  const filters = { status: opt("status"), poolId: opt("pool"), bin: opt("bin"), iin: opt("iin") };
  try {
    const db = await getDb();
    let csv: string;
    if (kind === "events") {
      const rows = await regulatorEvents(db, filters.poolId);
      csv = toCsv(["Time (UTC)", "Action", "Acting role", "Target type", "Target", "Transaction", "Detail"], rows.map((r) => [r.at, r.action, r.actingRole, r.targetType, r.targetId, r.signature, r.detail]));
    } else {
      const d = await regulatorData(db, Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)));
      csv =
        kind === "registry"
          ? toCsv(
              ["Pool", "Symbol", "Status", "Issuer wallet", "Issuer legal name", "Issuer BIN", "Raised (USD)", "Target (USD)", "Coupon (bps)", "Settlement", "Maturity (UTC)", "Holders", "Holders complete"],
              d.registry.map((r) => [r.poolId, r.symbol, r.status, r.issuerWallet, r.issuerLegalName, r.issuerBin, usd(r.raised), usd(r.target), r.couponBps, r.settlementMode, new Date(r.maturityTs * 1000).toISOString(), r.holders, r.holders === null ? "unknown" : r.holdersComplete ? "yes" : "no"]),
            )
          : toCsv(["Pool", "Wallet", "Balance (USD)", "Category", "IIN"], d.holders.map((h) => [h.poolId, h.wallet, usd(h.balance), h.category, h.iin]));
    }
    const today = new Date().toISOString().slice(0, 10);
    return new Response(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="f2f-${kind}-${today}.csv"`, "cache-control": "private, no-store" } });
  } catch (e) {
    Sentry.captureException(e);
    return fail(503, "The export could not be built. Try again in a minute.");
  }
}
