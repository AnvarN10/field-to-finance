"use server";

import type { ActionResult } from "@/lib/action-result";
import type { ApplicationStatus } from "@/lib/application-status";
import { arrangerChain } from "@/lib/server/chain-port";
import { consoleAction } from "@/lib/server/console-action";
import {
  advanceApplication,
  publishApplication,
  rejectApplication,
  reviewDocument,
  structureApplication,
  type TermsInput,
} from "@/lib/workflow/arranger";

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
