"use server";

import * as Sentry from "@sentry/nextjs";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import type { ApplicationStatus } from "@/lib/application-status";
import { parseArrangerEmails, type SessionUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/server/env";
import { explainChainError } from "@/lib/chain/explain";
import { ChainTxError } from "@/lib/chain/send";
import type { Db } from "@/lib/db/client";
import { auditLog, ROLES, type Role } from "@/lib/db/schema";
import { RequestError } from "@/lib/errors";
import { requireActionRole } from "@/lib/server/auth";
import { arrangerChain } from "@/lib/server/chain-port";
import { invalidateReads } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import {
  advanceApplication,
  decideFarmerKyc,
  decideInvestorKyc,
  publishApplication,
  rejectApplication,
  reviewDocument,
  structureApplication,
  verifyApplicationFields,
  type TermsInput,
} from "@/lib/workflow/arranger";
import { grantRoleByEmail, revokeRole } from "@/lib/workflow/users";
import type { ActionResult } from "./actions";

/** Signatures the workflow recorded in audit_log during this action (each step audits itself). */
async function signaturesSince(db: Db, actorId: string, since: Date): Promise<string[]> {
  const rows = await db
    .select({ sig: auditLog.txSignature, payload: auditLog.payload })
    .from(auditLog)
    .where(and(eq(auditLog.actorUserId, actorId), gte(auditLog.createdAt, since), isNotNull(auditLog.txSignature)));
  return rows.flatMap((r) => (Array.isArray(r.payload.signatures) ? (r.payload.signatures as string[]) : [r.sig as string]));
}

async function wf(message: string, fn: (actor: SessionUser, db: Db) => Promise<unknown>): Promise<ActionResult> {
  const since = new Date(Date.now() - 1000);
  try {
    const actor = await requireActionRole("arranger");
    const db = await getDb();
    await fn(actor, db);
    return { ok: true, message, signatures: await signaturesSince(db, actor.id, since) };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, error: { code: "BadRequest", title: e.message, detail: "", action: "none" }, logs: [] };
    if (e instanceof ChainTxError) return { ok: false, error: explainChainError({ logs: e.logs, error: e }), logs: e.logs };
    Sentry.captureException(e);
    return { ok: false, error: explainChainError({ error: e }), logs: [] };
  } finally {
    invalidateReads();
  }
}

const decision = (d: string) => {
  if (d !== "approved" && d !== "rejected") throw new RequestError("Unknown decision", 400);
  return d;
};

export const reviewDocumentAction = async (documentId: string, d: "accepted" | "rejected", note: string | null) =>
  wf(d === "accepted" ? "Document accepted" : "Document rejected; the farmer was notified", (a, db) => reviewDocument(db, a, documentId, d, note));

export const advanceAction = async (applicationId: string, to: ApplicationStatus) =>
  wf("Application moved on", (a, db) => advanceApplication(db, a, applicationId, to, arrangerChain()));

export const rejectAction = async (applicationId: string, reason: string) => wf("Application rejected", (a, db) => rejectApplication(db, a, applicationId, reason));

export const decideFarmerKycAction = async (farmerUserId: string, d: "approved" | "rejected", note: string | null) =>
  wf(d === "approved" ? "Issuer KYC approved and recorded on-chain" : "Issuer KYC rejected", (a, db) => decideFarmerKyc(db, a, farmerUserId, decision(d), note, arrangerChain()));

export const decideInvestorKycAction = async (investorUserId: string, d: "approved" | "rejected", note: string | null) =>
  wf(d === "approved" ? "Investor KYC approved" : "Investor KYC rejected", (a, db) => decideInvestorKyc(db, a, investorUserId, decision(d), note, arrangerChain()));

export const verifyFieldsAction = async (applicationId: string) =>
  wf("Fields verified with the SCAS stub", (a, db) => verifyApplicationFields(db, a, applicationId, arrangerChain()));

export const structureAction = async (applicationId: string, terms: TermsInput) =>
  wf("Pool created with the term sheet and the project added", (a, db) => structureApplication(db, a, applicationId, terms, arrangerChain()));

export const publishAction = async (applicationId: string) => wf("Pool is open for subscription", (a, db) => publishApplication(db, a, applicationId, arrangerChain()));

export const grantRoleAction = async (email: string, role: string) =>
  wf(`Role granted to ${email.trim().toLowerCase()}`, (a, db) => {
    if (!(ROLES as readonly string[]).includes(role)) throw new RequestError("Unknown role", 400);
    return grantRoleByEmail(db, a, email, role as Role);
  });

export const revokeRoleAction = async (userId: string, role: string) =>
  wf("Role removed", (a, db) => {
    if (!(ROLES as readonly string[]).includes(role)) throw new RequestError("Unknown role", 400);
    return revokeRole(db, a, userId, role as Role, parseArrangerEmails(serverEnv().ARRANGER_EMAILS));
  });
