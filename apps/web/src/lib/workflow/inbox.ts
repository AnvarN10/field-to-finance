import { effectiveElection } from "@f2f/sdk";
import { STATUS_INFO, type ApplicationStatus } from "../application-status";
import type { PoolDetail, PoolView } from "../chain/views";
import type { Db } from "../db/client";
import { lifecycle } from "../lifecycle";
import type { Permission } from "../permissions";
import { farmerKycQueue, investorQueue, pipeline } from "./arranger";
import { scasQueue } from "./scas";

export type InboxItem = { id: string; label: string; sub: string; href: string };
export type InboxQueue = { key: string; title: string; href: string; count: number; items: InboxItem[]; unavailable?: boolean };

/** Chain state the pool and delivery queues need; null when devnet did not answer. */
export type InboxChain = { pools: PoolView[]; details: PoolDetail[] } | null;

/** Application statuses where the arranger acts next (KYC and field verification belong to compliance and SCAS). */
const ARRANGER_STATUSES: ApplicationStatus[] = ["submitted", "documents_review", "structuring", "ready"];
const SHOWN = 5;

const queue = (key: string, title: string, href: string, items: InboxItem[], unavailable = false): InboxQueue => ({
  key,
  title,
  href,
  count: items.length,
  items: items.slice(0, SHOWN),
  ...(unavailable ? { unavailable } : {}),
});

/** Term-sheet pools on the delivery path at harvest (same rule as the Delivery section). */
export function deliveryPools(pools: PoolView[], now: number): PoolView[] {
  return pools.filter((p) => p.terms && p.terms.settlementMode !== "CashBuyback" && p.status === "Funded" && effectiveElection(p.terms, now, p.maturityTs) !== "Buyback");
}

/**
 * The console inbox (spec §6.2): one work queue per permission the user holds, oldest first. Labels never carry company
 * identity or emails in queues that partners without `issuers.view`/`investors.view` can see.
 */
export async function inboxQueues(db: Db, perms: ReadonlySet<Permission>, chain: InboxChain, now: number): Promise<InboxQueue[]> {
  const out: InboxQueue[] = [];
  if (perms.has("applications.review")) {
    const rows = (await pipeline(db)).filter((r) => ARRANGER_STATUSES.includes(r.status)).reverse();
    out.push(queue("applications", "Applications to review", "/console/applications", rows.map((r) => ({ id: r.id, label: `${r.legalName ?? "Applicant"} · ${r.crop} ${r.season}`, sub: STATUS_INFO[r.status].next, href: `/console/applications/${r.id}` }))));
  }
  if (perms.has("kyc.decide")) {
    const issuers = await farmerKycQueue(db);
    out.push(queue("issuer-kyc", "Issuer KYC", "/console/issuers", issuers.map((r) => ({ id: r.profile.userId, label: r.profile.legalName ?? r.email, sub: "Waiting for a KYC decision", href: "/console/issuers" }))));
    const investors = (await investorQueue(db)).reverse();
    out.push(queue("investor-kyc", "Investor KYC", "/console/investors", investors.map((r) => ({ id: r.userId, label: r.email, sub: `${r.profile.category ?? "Uncategorised"} investor`, href: "/console/investors" }))));
  }
  if (perms.has("verification.attest")) {
    const rows = await scasQueue(db);
    out.push(queue("fields", "Fields to verify", "/console/verification", rows.map((r) => ({ id: r.id, label: `${r.crop} ${r.season}`, sub: "Fields registered, waiting for verification", href: "/console/verification" }))));
  }
  if (perms.has("pools.operate")) {
    const items = (chain?.details ?? []).flatMap((d) => {
      const step = lifecycle(d, now).find((p) => p.state === "current" && p.owner === "arranger");
      return step ? [{ id: d.pool.poolId, label: `Pool ${d.pool.poolId} · ${d.pool.instrument?.symbol ?? "draft"}`, sub: step.next, href: `/console/pools/${d.pool.poolId}` }] : [];
    });
    out.push(queue("pool-actions", "Pool actions", "/console/pools", items, chain === null));
  }
  const delivery = chain ? deliveryPools(chain.pools, now) : [];
  const label = (p: PoolView) => `Pool ${p.poolId} · ${p.instrument?.symbol ?? ""}`.trim();
  if (perms.has("delivery.receipt")) {
    const items = delivery.filter((p) => !p.terms!.receiptHash).map((p) => ({ id: p.poolId, label: label(p), sub: "Elevator receipt missing", href: `/console/delivery?pool=${p.poolId}` }));
    out.push(queue("receipts", "Elevator receipts", "/console/delivery", items, chain === null));
  }
  if (perms.has("delivery.lab")) {
    const items = delivery.filter((p) => !p.terms!.labPassed).map((p) => ({ id: p.poolId, label: label(p), sub: "Passing lab protocol missing", href: `/console/delivery?pool=${p.poolId}` }));
    out.push(queue("lab", "Lab protocols", "/console/delivery", items, chain === null));
  }
  return out;
}
