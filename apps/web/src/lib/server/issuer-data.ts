import "server-only";
import type { HistoryRow } from "../../components/cabinet/history-table";
import type { ObligationItem } from "../../components/farmer/obligations";
import type { Db } from "../db/client";
import type { ApplicationRow } from "../db/schema";
import { formatUsd } from "../format";
import { farmerHistory, poolObligation } from "./cabinet-data";

const TX_LABEL: Record<string, string> = {
  "tx.register-project": "Fields registered on-chain",
  "tx.elect-settlement": "You elected the settlement",
  "tx.fund-redemption": "You funded the buyback",
  "pool.open": "Pool opened to investors",
  "pool.close_subscription": "Subscription closed",
  "pool.fund_redemption": "Redemption funded",
  "pool.elect_settlement": "Settlement elected",
  "pool.record_delivery": "Delivery document recorded",
  "pool.sweep": "Vault remainder returned",
};

/** Obligations per pooled application and the payouts and fees history (proceeds net of the arrangement fee). */
export async function issuerObligations(db: Db, userId: string, apps: ApplicationRow[], now: number): Promise<{ obligations: ObligationItem[]; history: HistoryRow[] }> {
  const pooled = apps.filter((a) => a.poolId);
  const loaded = (await Promise.all(pooled.map((a) => poolObligation(a.poolId as string, now)))).map((o, i) => (o ? { ...o, app: pooled[i]! } : null)).filter((o) => o !== null);
  const rows = await farmerHistory(db, userId, pooled.map((a) => a.poolId as string));
  const feeByPool = new Map(loaded.map((o) => [o.app.poolId as string, { fee: o.detail.arrangementFeeBps, requested: BigInt(o.app.requestedUsd) * 1_000_000n }]));
  const history = rows.flatMap((h): HistoryRow[] => {
    if (h.action === "pool.disburse") {
      const p = feeByPool.get(h.targetId);
      const fee = p ? (p.requested * BigInt(p.fee)) / 10_000n : null;
      return [
        { id: `${h.id}-pay`, at: h.createdAt, label: "Proceeds paid to your wallet", amount: p && fee !== null ? formatUsd(p.requested - fee) : null, signature: h.txSignature },
        ...(p && fee ? [{ id: `${h.id}-fee`, at: h.createdAt, label: "Arrangement fee withheld", amount: formatUsd(fee), signature: h.txSignature }] : []),
      ];
    }
    return [{ id: h.id, at: h.createdAt, label: TX_LABEL[h.action] ?? h.action, amount: null, signature: h.txSignature }];
  });
  return { obligations: loaded.map((o) => o.item), history };
}
