"use server";

import type { ActionResult } from "@/lib/action-result";
import type { ApplicationStatus } from "@/lib/application-status";
import { parseArrangerEmails } from "@/lib/auth/session";
import { ROLES, type Role } from "@/lib/db/schema";
import { RequestError } from "@/lib/errors";
import { arrangerChain } from "@/lib/server/chain-port";
import { consoleAction } from "@/lib/server/console-action";
import { serverEnv } from "@/lib/server/env";
import {
  advanceApplication,
  publishApplication,
  rejectApplication,
  reviewDocument,
  structureApplication,
  type TermsInput,
} from "@/lib/workflow/arranger";
import { grantRoleByEmail, revokeRole } from "@/lib/workflow/users";

export const reviewDocumentAction = async (documentId: string, d: "accepted" | "rejected", note: string | null): Promise<ActionResult> =>
  consoleAction("applications.review", d === "accepted" ? "Document accepted" : "Document rejected; the farmer was notified", (a, db) => reviewDocument(db, a, documentId, d, note));

export const advanceAction = async (applicationId: string, to: ApplicationStatus): Promise<ActionResult> =>
  consoleAction("applications.review", "Application moved on", (a, db) => advanceApplication(db, a, applicationId, to, arrangerChain()));

export const rejectAction = async (applicationId: string, reason: string): Promise<ActionResult> =>
  consoleAction("applications.review", "Application rejected", (a, db) => rejectApplication(db, a, applicationId, reason));

export const structureAction = async (applicationId: string, terms: TermsInput): Promise<ActionResult> =>
  consoleAction("pools.structure", "Pool created with the term sheet and the project added", (a, db) => structureApplication(db, a, applicationId, terms, arrangerChain()));

export const publishAction = async (applicationId: string): Promise<ActionResult> =>
  consoleAction("pools.structure", "Pool is open for subscription", (a, db) => publishApplication(db, a, applicationId, arrangerChain()));

export const grantRoleAction = async (email: string, role: string): Promise<ActionResult> =>
  consoleAction("team.manage", `Role granted to ${email.trim().toLowerCase()}`, (a, db) => {
    if (!(ROLES as readonly string[]).includes(role)) throw new RequestError("Unknown role", 400);
    return grantRoleByEmail(db, a, email, role as Role);
  });

export const revokeRoleAction = async (userId: string, role: string): Promise<ActionResult> =>
  consoleAction("team.manage", "Role removed", (a, db) => {
    if (!(ROLES as readonly string[]).includes(role)) throw new RequestError("Unknown role", 400);
    return revokeRole(db, a, userId, role as Role, parseArrangerEmails(serverEnv().ARRANGER_EMAILS));
  });
