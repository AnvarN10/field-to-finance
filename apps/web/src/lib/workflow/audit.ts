import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { auditLog, type AuditRow } from "../db/schema";

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  payload?: Record<string, unknown>;
  signatures?: string[];
  error?: string;
}

const short = (s: string) => (s.length > 300 ? `${s.slice(0, 300)}…` : s);

export async function audit(db: Db, e: AuditEntry): Promise<void> {
  const signatures = (e.signatures ?? []).filter(Boolean);
  await db.insert(auditLog).values({
    actorUserId: e.actorUserId,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    payload: { ...(e.payload ?? {}), ...(signatures.length > 1 ? { signatures } : {}), ...(e.error ? { error: short(e.error) } : {}) },
    txSignature: signatures[0] ?? null,
  });
}

/** Runs an on-chain step and records it either way: signatures on success, the error message on failure (then rethrows). */
export async function audited<T>(db: Db, base: Omit<AuditEntry, "signatures" | "error">, fn: () => Promise<T>, signaturesOf: (r: T) => (string | null)[]): Promise<T> {
  let result: T;
  try {
    result = await fn();
  } catch (e) {
    await audit(db, { ...base, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
  await audit(db, { ...base, signatures: signaturesOf(result).filter((s): s is string => Boolean(s)) });
  return result;
}

export async function listAudit(db: Db, f: { limit?: number; targetType?: string; targetId?: string } = {}): Promise<AuditRow[]> {
  const where = [f.targetType ? eq(auditLog.targetType, f.targetType) : undefined, f.targetId ? eq(auditLog.targetId, f.targetId) : undefined].filter(
    (w): w is NonNullable<typeof w> => Boolean(w),
  );
  return db
    .select()
    .from(auditLog)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(f.limit ?? 100, 500));
}
