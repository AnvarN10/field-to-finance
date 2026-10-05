import "server-only";
import { isNotNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { applications } from "../db/schema";
import { createThrottle } from "../throttle";
import { maturityReminders } from "../workflow/notifications";
import { getReader } from "./context";

// Reminders read the pool list (cached) and write at most one row per pool and person; once every 5 minutes is plenty.
const throttle = createThrottle(5 * 60_000);

/** "Matures within 7 days" for every pool with an application, to its investors and its farmer. */
export async function remindMaturities(db: Db): Promise<void> {
  if (!throttle.take()) return;
  const [pools, apps] = await Promise.all([getReader().listPools(), db.select({ poolAddress: applications.poolAddress, farmer: applications.farmerUserId }).from(applications).where(isNotNull(applications.poolAddress))]);
  const farmerOfPool = new Map(apps.map((a) => [a.poolAddress as string, a.farmer]));
  const now = Math.floor(Date.now() / 1000);
  await maturityReminders(db, pools.filter((p) => p.status === "Open" || p.status === "Funded").map((p) => ({ address: p.address, poolId: p.poolId, symbol: p.instrument?.symbol ?? `POOL-${p.poolId}`, maturityTs: p.maturityTs })), now, farmerOfPool);
}
