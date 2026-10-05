import "server-only";
import { inArray } from "drizzle-orm";
import type { AuditView } from "../../components/arranger/audit-table";
import type { Db } from "../db/client";
import { users, type AuditRow } from "../db/schema";
import { shortKey } from "../format";

const DETAIL_KEYS = ["role", "kind", "wallet", "poolId", "project", "from", "to", "election", "rule", "symbol", "category", "note", "reason", "usd", "amount", "pool", "message"] as const;

function detail(p: Record<string, unknown>): string {
  return DETAIL_KEYS.filter((k) => p[k] !== undefined && p[k] !== null)
    .map((k) => {
      const v = String(p[k]);
      return `${k} ${/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v) ? shortKey(v) : v.length > 80 ? `${v.slice(0, 80)}…` : v}`;
    })
    .join(", ");
}

/** Audit rows with actor emails for the arranger's audit table. */
export async function auditViews(db: Db, rows: AuditRow[]): Promise<AuditView[]> {
  const ids = [...new Set(rows.map((r) => r.actorUserId).filter((x): x is string => Boolean(x)))];
  const people = ids.length ? await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, ids)) : [];
  const email = new Map(people.map((p) => [p.id, p.email]));
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt,
    actor: r.actorUserId ? (email.get(r.actorUserId) ?? "deleted user") : "system",
    action: r.action,
    target: `${r.targetType} ${/^[0-9a-f-]{36}$/.test(r.targetId) ? r.targetId.slice(0, 8) : shortKey(r.targetId)}`,
    detail: detail(r.payload),
    signature: r.txSignature,
    error: typeof r.payload.error === "string" ? r.payload.error : null,
  }));
}
