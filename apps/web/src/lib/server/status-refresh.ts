import "server-only";
import type { Db } from "../db/client";
import { createThrottle } from "../throttle";
import { refreshChainStatuses } from "../workflow/arranger";
import { arrangerChain } from "./chain-port";

// The public devnet RPC rate-limits program-account scans; page loads refresh chain-derived statuses at most every 30 s.
const throttle = createThrottle(30_000);

/** Derives and caches application statuses from chain state. Arranger actions pass force; page loads are throttled. */
export async function refreshStatuses(db: Db, force = false): Promise<void> {
  if (!throttle.take(force)) return;
  await refreshChainStatuses(db, arrangerChain(), Math.floor(Date.now() / 1000)).catch(() => 0);
}
