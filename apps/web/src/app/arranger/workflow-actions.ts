"use server";

import type { ApplicationStatus } from "@/lib/application-status";
import { parseArrangerEmails, type SessionUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/server/env";
import type { Db } from "@/lib/db/client";
import { ROLES, type Role } from "@/lib/db/schema";
import { RequestError } from "@/lib/errors";
import { requireActionRole } from "@/lib/server/auth";
import { arrangerChain } from "@/lib/server/chain-port";
import { invalidateReads } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import { actionError, signaturesSince } from "@/lib/server/service-action";
import {
  advanceApplication,
  publishApplication,
  rejectApplication,
  reviewDocument,
  structureApplication,
  type TermsInput,
} from "@/lib/workflow/arranger";
import { grantRoleByEmail, revokeRole } from "@/lib/workflow/users";
import type { ActionResult } from "./actions";

async function wf(message: string, fn: (actor: SessionUser, db: Db) => Promise<unknown>): Promise<ActionResult> {
  const since = new Date(Date.now() - 1000);
  try {
    const actor = await requireActionRole("arranger");
    const db = await getDb();
    await fn(actor, db);
    return { ok: true, message, signatures: await signaturesSince(db, actor.id, since) };
  } catch (e) {
    return actionError(e);
  } finally {
    invalidateReads();
  }
}

export const reviewDocumentAction = async (documentId: string, d: "accepted" | "rejected", note: string | null) =>
  wf(d === "accepted" ? "Document accepted" : "Document rejected; the farmer was notified", (a, db) => reviewDocument(db, a, documentId, d, note));

export const advanceAction = async (applicationId: string, to: ApplicationStatus) =>
  wf("Application moved on", (a, db) => advanceApplication(db, a, applicationId, to, arrangerChain()));

export const rejectAction = async (applicationId: string, reason: string) => wf("Application rejected", (a, db) => rejectApplication(db, a, applicationId, reason));

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
