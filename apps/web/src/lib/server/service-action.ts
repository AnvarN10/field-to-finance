import "server-only";
import * as Sentry from "@sentry/nextjs";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import type { ActionResult } from "../../app/arranger/actions";
import type { SessionUser } from "../auth/session";
import { explainChainError } from "../chain/explain";
import { ChainTxError } from "../chain/send";
import type { Db } from "../db/client";
import { auditLog, type ServiceRole } from "../db/schema";
import { RequestError } from "../errors";
import { requireServiceAction } from "./auth";
import { invalidateReads } from "./context";
import { getDb } from "./db";

/** Signatures the workflow recorded in audit_log during this action (each step audits itself). */
export async function signaturesSince(db: Db, actorId: string, since: Date): Promise<string[]> {
  const rows = await db
    .select({ sig: auditLog.txSignature, payload: auditLog.payload })
    .from(auditLog)
    .where(and(eq(auditLog.actorUserId, actorId), gte(auditLog.createdAt, since), isNotNull(auditLog.txSignature)));
  return rows.flatMap((r) => (Array.isArray(r.payload.signatures) ? (r.payload.signatures as string[]) : [r.sig as string]));
}

/** Errors as the cabinets show them: plain text for request errors, explained program errors, GlitchTip for the rest. */
export function actionError(e: unknown): ActionResult {
  if (e instanceof RequestError) return { ok: false, error: { code: "BadRequest", title: e.message, detail: "", action: "none" }, logs: [] };
  if (e instanceof ChainTxError) return { ok: false, error: explainChainError({ logs: e.logs, error: e }), logs: e.logs };
  Sentry.captureException(e);
  return { ok: false, error: explainChainError({ error: e }), logs: [] };
}

/**
 * A service cabinet action (ADR 0017): the role guard first (the role holder or an arranger acting for it), then the
 * workflow, which audits each step with the acting role; the result carries the signatures written meanwhile.
 */
export async function serviceAction(role: ServiceRole, message: string, fn: (user: SessionUser, db: Db) => Promise<unknown>): Promise<ActionResult> {
  const since = new Date(Date.now() - 1000);
  try {
    const actor = await requireServiceAction(role);
    const db = await getDb();
    await fn(actor.user, db);
    return { ok: true, message, signatures: await signaturesSince(db, actor.user.id, since) };
  } catch (e) {
    return actionError(e);
  } finally {
    invalidateReads();
  }
}
