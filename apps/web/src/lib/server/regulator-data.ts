import "server-only";
import type { Db } from "../db/client";
import { eventRows, filterRegistry, holderRows, registryRows, type EventRow, type HolderRow, type RegistryRow } from "../workflow/regulator";
import { getReader } from "./context";

export interface RegulatorFilters {
  status?: string;
  poolId?: string;
  bin?: string;
  iin?: string;
}

/** Registry and holders across every published pool (Draft pools are not offered yet). Holder scans run one pool at a time. */
export async function regulatorData(db: Db, f: RegulatorFilters = {}): Promise<{ registry: RegistryRow[]; holders: HolderRow[] }> {
  const reader = getReader();
  const pools = (await reader.listPools()).filter((p) => p.status !== "Draft");
  const raw: { poolId: string; wallet: string; balance: string }[] = [];
  for (const p of pools) for (const h of await reader.holders(p.mint)) raw.push({ poolId: p.poolId, ...h });
  const holders = await holderRows(db, raw);
  const counts = new Map<string, number>();
  const byIin = new Map<string, Set<string>>();
  for (const h of holders) {
    counts.set(h.poolId, (counts.get(h.poolId) ?? 0) + 1);
    if (h.iin) byIin.set(h.iin, (byIin.get(h.iin) ?? new Set()).add(h.poolId));
  }
  const registry = filterRegistry(await registryRows(db, pools, counts), { ...f, holdersByIin: byIin });
  const shown = new Set(registry.map((r) => r.poolId));
  return { registry, holders: holders.filter((h) => shown.has(h.poolId) && (!f.iin || h.iin === f.iin.trim())) };
}

export async function regulatorEvents(db: Db, poolId?: string): Promise<EventRow[]> {
  const pool = poolId ? (await getReader().listPools()).find((p) => p.poolId === poolId) : undefined;
  return eventRows(db, poolId ? { poolId, ...(pool ? { poolAddress: pool.address } : {}) } : {});
}
