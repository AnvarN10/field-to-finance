"use server";

import * as Sentry from "@sentry/nextjs";
import type { SessionUser } from "@/lib/auth/session";
import type { Db } from "@/lib/db/client";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/db/schema";
import { RequestError } from "@/lib/errors";
import { storeDocument, storeFieldSet, type FieldSetEntry } from "@/lib/pilot-docs";
import { requireAccount } from "@/lib/server/auth";
import { arrangerChain } from "@/lib/server/chain-port";
import { getStore } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import {
  addApplicationDocument,
  attachProject,
  createApplication,
  saveFarmerProfile,
  submitApplication,
  submitFarmerKyc,
  withdrawApplication,
} from "@/lib/workflow/farmer";

export type FarmerResult = { ok: true } | { ok: false; error: string };

async function act<T extends object = object>(fn: (user: SessionUser, db: Db) => Promise<T | void>): Promise<({ ok: true } & T) | { ok: false; error: string }> {
  try {
    const user = await requireAccount("farmer");
    const extra = await fn(user, await getDb());
    return { ok: true, ...(extra ?? ({} as T)) };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, error: e.message };
    Sentry.captureException(e);
    return { ok: false, error: "Something went wrong. Try again in a minute." };
  }
}

async function fileOf(form: FormData): Promise<{ bytes: Uint8Array; type: string }> {
  const f = form.get("file");
  if (!(f instanceof File) || f.size === 0) throw new RequestError("Choose a file", 400);
  return { bytes: new Uint8Array(await f.arrayBuffer()), type: f.type };
}

export const saveProfileAction = async (input: unknown) => act(async (user, db) => void (await saveFarmerProfile(db, user, input)));

/** Issuer KYC document: stored in the bucket (owner and arrangers only), then the KYC goes to the arranger's queue. */
export const uploadKycAction = async (form: FormData) =>
  act(async (user, db) => {
    const { bytes, type } = await fileOf(form);
    const doc = await storeDocument(getStore(), bytes, type);
    await submitFarmerKyc(db, user, doc);
  });

export const createApplicationAction = async (input: unknown) => act(async (user, db) => ({ id: (await createApplication(db, user, input)).id }));

export const uploadDocumentAction = async (applicationId: string, kind: string, form: FormData) =>
  act(async (user, db) => {
    if (!(DOCUMENT_KINDS as readonly string[]).includes(kind) || kind === "kyc") throw new RequestError("Unknown document type", 400);
    const { bytes, type } = await fileOf(form);
    const doc = await storeDocument(getStore(), bytes, type);
    await addApplicationDocument(db, user, applicationId, kind as DocumentKind, doc);
  });

/**
 * Links the farm project the farmer just registered. The producer is read from the chain, never taken from the browser,
 * and the field set (names, cadastral numbers, declared areas) goes to the bucket only.
 */
export const attachProjectAction = async (applicationId: string, projectAddress: string, fields: FieldSetEntry[]) =>
  act(async (user, db) => {
    const project = await arrangerChain().project(projectAddress).catch(() => null);
    if (!project) throw new RequestError("The project is not on-chain yet. Wait a few seconds and try again.", 409);
    const fieldSet = fields.length ? await storeFieldSet(getStore(), fields) : null;
    await attachProject(db, user, applicationId, projectAddress, project.producer, fieldSet?.hash);
  });

export const submitApplicationAction = async (applicationId: string) => act(async (user, db) => void (await submitApplication(db, user, applicationId)));

export const withdrawApplicationAction = async (applicationId: string) => act(async (user, db) => void (await withdrawApplication(db, user, applicationId)));
