import * as Sentry from "@sentry/nextjs";
import { RequestError } from "@/lib/errors";
import { formatUsd } from "@/lib/format";
import { requireActionRole } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { investorPortfolio } from "@/lib/server/investor-data";
import { statementCsv, type StatementRow } from "@/lib/statement";

export const dynamic = "force-dynamic";

const plain = (base: string) => formatUsd(base).replace(/[$,]/g, "");

/** CSV statement of the signed-in investor: transactions, then current holdings. */
export async function GET() {
  let user;
  try {
    user = await requireActionRole("investor");
  } catch (e) {
    const status = e instanceof RequestError ? e.status : 503;
    return Response.json({ error: e instanceof Error ? e.message : "unavailable" }, { status, headers: { "cache-control": "private, no-store" } });
  }
  try {
    const p = await investorPortfolio(await getDb(), user);
    const today = new Date().toISOString().slice(0, 10);
    const rows: StatementRow[] = [
      ...p.history.map((h) => ({ date: h.at.toISOString().slice(0, 10), type: h.label, pool: h.pool, amountUsd: h.amount ? plain(h.amount) : "", tokens: h.tokens ?? "", signature: h.signature ?? "" })),
      ...p.positions.map((r) => ({ date: today, type: "Holding", pool: r.symbol, amountUsd: plain(r.holding), tokens: r.tokens ?? "", signature: "" })),
    ];
    return new Response(statementCsv(rows), {
      status: 200,
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="f2f-statement-${today}.csv"`, "cache-control": "private, no-store" },
    });
  } catch (e) {
    Sentry.captureException(e);
    return Response.json({ error: "The statement could not be built. Try again in a minute." }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
}
