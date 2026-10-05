import "server-only";
import { recordUserTransaction, type UserTx } from "../workflow/tx-history";
import { getReader } from "./context";
import { getDb } from "./db";

/** A user transaction the sponsor co-signed, in the audit log as `tx.<action>` (the investor and farmer history read it). */
export async function recordUserTx(t: UserTx): Promise<void> {
  const db = await getDb();
  const pools = t.pool ? await getReader().listPools().catch(() => []) : [];
  const p = pools.find((x) => x.address === t.pool);
  await recordUserTransaction(db, t, p ? { poolId: p.poolId, symbol: p.instrument?.symbol ?? `POOL-${p.poolId}` } : null);
}
