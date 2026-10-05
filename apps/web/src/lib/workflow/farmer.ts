import { MAX_COUPON_BPS, MAX_SHORT_STR_LEN, MAX_TOKENIZED_SHARE_BPS } from "@f2f/sdk";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { canTransition } from "../application-status";
import type { SessionUser } from "../auth/session";
import type { Db } from "../db/client";
import { applications, documents, farmerProfiles, wallets, type ApplicationRow, type DocumentKind, type FarmerProfileRow } from "../db/schema";
import { RequestError } from "../errors";
import { audit } from "./audit";
import { checklist, currentDocuments, REQUIRED_KINDS, type ChecklistRow } from "./documents";
import { assertRole, assertUuid, parseOr400 } from "./guards";
import type { StoredDocInput } from "./ports";

const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const farmerProfileInput = z.object({
  legalName: z.string().trim().min(2, "enter the company's legal name").max(120),
  bin: z.string().trim().regex(/^\d{12}$/, "BIN is 12 digits"),
  region: z.string().trim().min(2, "enter the region").max(80),
  contact: z.string().trim().min(2, "enter a contact").max(120),
});
export type FarmerProfileInput = z.infer<typeof farmerProfileInput>;

export const applicationInput = z.object({
  crop: z.string().trim().min(1).max(16),
  grade: z.string().trim().min(1, "enter the grade").max(16),
  volumeT: z.number().int().min(1, "volume must be at least 1 t").max(10_000_000),
  tokenizedShareBps: z.number().int().min(1).max(MAX_TOKENIZED_SHARE_BPS, `tokenized share must be at most ${MAX_TOKENIZED_SHARE_BPS / 100}%`),
  requestedUsd: z.number().int().min(1, "request at least $1").max(100_000_000),
  proposedCouponBps: z.number().int().min(0).max(MAX_COUPON_BPS, `coupon must be at most ${MAX_COUPON_BPS / 100}%`),
  season: z.number().int().min(2025).max(2100),
  elevator: z.string().trim().min(1, "name the elevator").max(MAX_SHORT_STR_LEN, `at most ${MAX_SHORT_STR_LEN} characters`),
  lab: z.string().trim().min(1, "name the laboratory").max(MAX_SHORT_STR_LEN, `at most ${MAX_SHORT_STR_LEN} characters`),
});
export type ApplicationInput = z.infer<typeof applicationInput>;

const profileComplete = (p: FarmerProfileRow | undefined) => Boolean(p?.legalName && p.bin && p.region && p.contact);

export async function farmerProfile(db: Db, userId: string): Promise<FarmerProfileRow | undefined> {
  return db.query.farmerProfiles.findFirst({ where: eq(farmerProfiles.userId, userId) });
}

export async function saveFarmerProfile(db: Db, user: SessionUser, input: unknown): Promise<FarmerProfileRow> {
  assertRole(user, "farmer");
  const v = parseOr400(farmerProfileInput, input);
  const [row] = await db
    .insert(farmerProfiles)
    .values({ userId: user.id, ...v })
    .onConflictDoUpdate({ target: farmerProfiles.userId, set: { ...v, updatedAt: new Date() } })
    .returning();
  return row as FarmerProfileRow;
}

/** Issuer KYC: the farmer uploads the charter and director ID; the arranger decides and writes the on-chain KYC record. */
export async function submitFarmerKyc(db: Db, user: SessionUser, doc: StoredDocInput): Promise<FarmerProfileRow> {
  assertRole(user, "farmer");
  const profile = await farmerProfile(db, user.id);
  if (!profileComplete(profile)) throw new RequestError("Fill in the company profile first.", 409);
  if (profile?.kycStatus === "approved") throw new RequestError("Issuer KYC is already approved.", 409);
  await replaceCurrent(db, user.id, null, "kyc");
  await db.insert(documents).values({ ownerUserId: user.id, applicationId: null, kind: "kyc", ...doc, bucketKey: `documents/${doc.sha256}` });
  const [row] = await db.update(farmerProfiles).set({ kycStatus: "pending", kycNote: null, updatedAt: new Date() }).where(eq(farmerProfiles.userId, user.id)).returning();
  await audit(db, { actorUserId: user.id, action: "farmer_kyc.submit", targetType: "user", targetId: user.id, payload: { sha256: doc.sha256 } });
  return row as FarmerProfileRow;
}

async function replaceCurrent(db: Db, ownerUserId: string, applicationId: string | null, kind: DocumentKind): Promise<void> {
  await db
    .update(documents)
    .set({ replacedAt: new Date() })
    .where(
      and(
        eq(documents.ownerUserId, ownerUserId),
        applicationId ? eq(documents.applicationId, applicationId) : isNull(documents.applicationId),
        eq(documents.kind, kind),
        isNull(documents.replacedAt),
      ),
    );
}

export async function createApplication(db: Db, user: SessionUser, input: unknown): Promise<ApplicationRow> {
  assertRole(user, "farmer");
  const v = parseOr400(applicationInput, input);
  const [row] = await db.insert(applications).values({ farmerUserId: user.id, ...v }).returning();
  await audit(db, { actorUserId: user.id, action: "application.create", targetType: "application", targetId: (row as ApplicationRow).id });
  return row as ApplicationRow;
}

export async function getOwnApplication(db: Db, user: SessionUser, id: string): Promise<ApplicationRow> {
  assertRole(user, "farmer");
  assertUuid(id, "Application");
  const row = await db.query.applications.findFirst({ where: and(eq(applications.id, id), eq(applications.farmerUserId, user.id)) });
  if (!row) throw new RequestError("Application not found", 404);
  return row;
}

export async function updateApplication(db: Db, user: SessionUser, id: string, input: unknown): Promise<ApplicationRow> {
  const app = await getOwnApplication(db, user, id);
  if (app.status !== "draft") throw new RequestError("Only a draft can be edited.", 409);
  const v = parseOr400(applicationInput, input);
  const [row] = await db.update(applications).set({ ...v, updatedAt: new Date() }).where(eq(applications.id, id)).returning();
  return row as ApplicationRow;
}

/** Uploads stay open in draft; after submission only a rejected (or missing) document can be replaced. */
export async function addApplicationDocument(db: Db, user: SessionUser, id: string, kind: DocumentKind, doc: StoredDocInput): Promise<ChecklistRow[]> {
  const app = await getOwnApplication(db, user, id);
  if (!(REQUIRED_KINDS as readonly string[]).includes(kind) && kind !== "other") throw new RequestError("Unknown document type", 400);
  const current = (await currentDocuments(db, id)).find((d) => d.kind === kind);
  const reviewOpen = app.status === "submitted" || app.status === "documents_review";
  const allowed = app.status === "draft" || (reviewOpen && (!current || current.status === "rejected"));
  if (!allowed) throw new RequestError(app.status === "draft" || reviewOpen ? "This document is already under review." : "Documents are closed for this application.", 409);
  await replaceCurrent(db, user.id, id, kind);
  await db.insert(documents).values({ ownerUserId: user.id, applicationId: id, kind, ...doc, bucketKey: `documents/${doc.sha256}` });
  await audit(db, { actorUserId: user.id, action: "document.upload", targetType: "application", targetId: id, payload: { kind, sha256: doc.sha256 } });
  return checklist(db, id);
}

/** Links the on-chain farm project (registered and signed by the farmer's wallet) to the application. */
export async function attachProject(db: Db, user: SessionUser, id: string, projectAddress: string, producer: string, fieldSetHash?: string): Promise<ApplicationRow> {
  const app = await getOwnApplication(db, user, id);
  if (app.status !== "draft") throw new RequestError("Fields can only change while the application is a draft.", 409);
  if (!WALLET.test(projectAddress) || !WALLET.test(producer)) throw new RequestError("Invalid project address", 400);
  if (fieldSetHash !== undefined && !/^[0-9a-f]{64}$/.test(fieldSetHash)) throw new RequestError("Invalid field set", 400);
  const own = await db.query.wallets.findFirst({ where: and(eq(wallets.address, producer), eq(wallets.userId, user.id)) });
  if (!own) throw new RequestError("The project was registered by a wallet that is not yours.", 403);
  const [row] = await db
    .update(applications)
    .set({ projectAddress, ...(fieldSetHash ? { fieldSetHash } : {}), updatedAt: new Date() })
    .where(eq(applications.id, id))
    .returning();
  await audit(db, { actorUserId: user.id, action: "application.attach_project", targetType: "application", targetId: id, payload: { project: projectAddress } });
  return row as ApplicationRow;
}

export async function submitApplication(db: Db, user: SessionUser, id: string): Promise<ApplicationRow> {
  const app = await getOwnApplication(db, user, id);
  if (!canTransition(app.status, "submitted")) throw new RequestError("Only a draft can be submitted.", 409);
  if (!profileComplete(await farmerProfile(db, user.id))) throw new RequestError("Fill in the company profile first.", 409);
  const missing = (await checklist(db, id)).filter((r) => r.status === "missing" || r.status === "rejected");
  if (missing.length) throw new RequestError(`Upload ${missing.map((m) => m.label.toLowerCase()).join("; ")}.`, 409);
  if (!app.projectAddress) throw new RequestError("Upload and register your fields first.", 409);
  const [row] = await db.update(applications).set({ status: "submitted", updatedAt: new Date() }).where(eq(applications.id, id)).returning();
  await audit(db, { actorUserId: user.id, action: "application.submit", targetType: "application", targetId: id });
  return row as ApplicationRow;
}

export async function withdrawApplication(db: Db, user: SessionUser, id: string): Promise<ApplicationRow> {
  const app = await getOwnApplication(db, user, id);
  if (!canTransition(app.status, "withdrawn")) throw new RequestError("This application can no longer be withdrawn.", 409);
  const [row] = await db.update(applications).set({ status: "withdrawn", updatedAt: new Date() }).where(eq(applications.id, id)).returning();
  await audit(db, { actorUserId: user.id, action: "application.withdraw", targetType: "application", targetId: id });
  return row as ApplicationRow;
}

export const farmerChecklist = checklist;

export async function farmerApplications(db: Db, userId: string): Promise<ApplicationRow[]> {
  return db.select().from(applications).where(eq(applications.farmerUserId, userId)).orderBy(desc(applications.createdAt));
}

export async function farmerKycDocument(db: Db, userId: string) {
  return db.query.documents.findFirst({ where: and(eq(documents.ownerUserId, userId), eq(documents.kind, "kyc"), isNull(documents.replacedAt)) });
}

export const isProfileComplete = profileComplete;
