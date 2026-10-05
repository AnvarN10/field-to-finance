import { SETTLEMENT_MODES } from "@f2f/sdk";
import { and, desc, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { z } from "zod";
import { canTransition, deriveFromChain, STATUS_INFO, type ApplicationStatus } from "../application-status";
import type { SessionUser } from "../auth/session";
import { createPoolInput, type CreatePoolInput } from "../chain/admin-ops";
import type { Db } from "../db/client";
import {
  applications,
  documents,
  farmerProfiles,
  investorProfiles,
  users,
  wallets,
  type ApplicationRow,
  type AuditRow,
  type DocumentRow,
  type FarmerProfileRow,
  type InvestorProfileRow,
} from "../db/schema";
import { RequestError } from "../errors";
import { audit, audited, listAudit } from "./audit";
import { checklist, type ChecklistRow } from "./documents";
import { assertRole, assertUuid, parseOr400 } from "./guards";
import { notify } from "./notifications";
import type { ArrangerChain } from "./ports";

async function loadApplication(db: Db, id: string): Promise<ApplicationRow> {
  assertUuid(id, "Application");
  const row = await db.query.applications.findFirst({ where: eq(applications.id, id) });
  if (!row) throw new RequestError("Application not found", 404);
  return row;
}

async function setStatus(db: Db, app: ApplicationRow, to: ApplicationStatus, note: string | null = null): Promise<ApplicationRow> {
  const [row] = await db.update(applications).set({ status: to, statusNote: note, updatedAt: new Date() }).where(eq(applications.id, app.id)).returning();
  await notify(db, app.farmerUserId, "application", `Application: ${STATUS_INFO[to].label}`, note ?? STATUS_INFO[to].next);
  return row as ApplicationRow;
}

export interface PipelineRow extends ApplicationRow {
  farmerEmail: string;
  legalName: string | null;
}

export async function pipeline(db: Db): Promise<PipelineRow[]> {
  const rows = await db
    .select({ app: applications, email: users.email, legalName: farmerProfiles.legalName })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.farmerUserId))
    .leftJoin(farmerProfiles, eq(farmerProfiles.userId, applications.farmerUserId))
    .orderBy(desc(applications.updatedAt));
  return rows.map((r) => ({ ...r.app, farmerEmail: r.email, legalName: r.legalName }));
}

export interface ApplicationDetail {
  application: ApplicationRow;
  farmer: { id: string; email: string };
  profile: FarmerProfileRow | null;
  farmerWallets: string[];
  kycDocument: DocumentRow | null;
  checklist: ChecklistRow[];
  history: DocumentRow[];
  audit: AuditRow[];
}

export async function applicationDetail(db: Db, id: string): Promise<ApplicationDetail> {
  const application = await loadApplication(db, id);
  const [farmer, profile, ws, kycDocs, list, history, log] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, application.farmerUserId) }),
    db.query.farmerProfiles.findFirst({ where: eq(farmerProfiles.userId, application.farmerUserId) }),
    db.select().from(wallets).where(eq(wallets.userId, application.farmerUserId)),
    db.select().from(documents).where(and(eq(documents.ownerUserId, application.farmerUserId), eq(documents.kind, "kyc"))).orderBy(desc(documents.createdAt)),
    checklist(db, id),
    db.select().from(documents).where(eq(documents.applicationId, id)).orderBy(desc(documents.createdAt)),
    listAudit(db, { targetType: "application", targetId: id, limit: 50 }),
  ]);
  return {
    application,
    farmer: { id: application.farmerUserId, email: farmer?.email ?? "" },
    profile: profile ?? null,
    farmerWallets: ws.map((w) => w.address),
    kycDocument: kycDocs[0] ?? null,
    checklist: list,
    history,
    audit: log,
  };
}

export async function reviewDocument(db: Db, actor: SessionUser, documentId: string, decision: "accepted" | "rejected", note: string | null): Promise<void> {
  assertRole(actor, "arranger");
  assertUuid(documentId, "Document");
  if (decision !== "accepted" && decision !== "rejected") throw new RequestError("Unknown decision", 400);
  const reason = note?.trim() ?? "";
  if (decision === "rejected" && reason.length < 3) throw new RequestError("Say why the document is rejected, so the farmer can fix it.", 400);
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
  if (!doc || doc.replacedAt) throw new RequestError("Document not found or replaced by a newer upload", 404);
  if (doc.applicationId) {
    const app = await loadApplication(db, doc.applicationId);
    if (app.status !== "documents_review" && app.status !== "submitted") throw new RequestError("Documents are reviewed during the document review step.", 409);
  }
  await db
    .update(documents)
    .set({ status: decision, reviewNote: reason || null, reviewedBy: actor.id, reviewedAt: new Date() })
    .where(eq(documents.id, documentId));
  await audit(db, {
    actorUserId: actor.id,
    action: decision === "accepted" ? "document.accept" : "document.reject",
    targetType: doc.applicationId ? "application" : "user",
    targetId: doc.applicationId ?? doc.ownerUserId,
    payload: { documentId, kind: doc.kind, ...(reason ? { note: reason } : {}) },
  });
  if (decision === "rejected") await notify(db, doc.ownerUserId, "document", "A document needs a new upload", reason);
}

/** Pre-open moves with their gates. `open` happens only through publishApplication; reject through rejectApplication. */
export async function advanceApplication(db: Db, actor: SessionUser, id: string, to: ApplicationStatus, chain: ArrangerChain): Promise<ApplicationRow> {
  assertRole(actor, "arranger");
  const app = await loadApplication(db, id);
  if (to === "open") throw new RequestError("Publish the pool to open it.", 409);
  if (to === "rejected" || to === "withdrawn" || !canTransition(app.status, to)) throw new RequestError(`Cannot move from ${STATUS_INFO[app.status].label} to ${STATUS_INFO[to].label}.`, 409);
  if (to === "kyc") {
    const notAccepted = (await checklist(db, id)).filter((r) => r.status !== "accepted");
    if (notAccepted.length) throw new RequestError(`Accept every required document first (${notAccepted.length} left).`, 409);
  }
  if (to === "field_verification") {
    const p = await db.query.farmerProfiles.findFirst({ where: eq(farmerProfiles.userId, app.farmerUserId) });
    if (p?.kycStatus !== "approved") throw new RequestError("Approve the issuer's KYC first.", 409);
  }
  if (to === "structuring") {
    const project = app.projectAddress ? await chain.project(app.projectAddress) : null;
    if (!project || project.fieldCount === 0 || project.verifiedFieldCount < project.fieldCount) throw new RequestError("Verify every field with the SCAS stub first.", 409);
  }
  if (to === "ready" && !app.poolId) throw new RequestError("Create the pool with the term builder first.", 409);
  const row = await setStatus(db, app, to);
  await audit(db, { actorUserId: actor.id, action: "application.advance", targetType: "application", targetId: id, payload: { from: app.status, to } });
  return row;
}

export async function rejectApplication(db: Db, actor: SessionUser, id: string, reason: string): Promise<ApplicationRow> {
  assertRole(actor, "arranger");
  const app = await loadApplication(db, id);
  const r = reason.trim();
  if (r.length < 3) throw new RequestError("Give the farmer a reason.", 400);
  if (!canTransition(app.status, "rejected")) throw new RequestError("This application can no longer be rejected.", 409);
  const row = await setStatus(db, app, "rejected", r);
  await audit(db, { actorUserId: actor.id, action: "application.reject", targetType: "application", targetId: id, payload: { reason: r } });
  return row;
}

/** Issuer KYC decision. Approval writes the platform KYC record on-chain for the farmer's wallet first. */
export async function decideFarmerKyc(db: Db, actor: SessionUser, farmerUserId: string, decision: "approved" | "rejected", note: string | null, chain: ArrangerChain): Promise<void> {
  assertRole(actor, "arranger");
  assertUuid(farmerUserId, "Farmer");
  const profile = await db.query.farmerProfiles.findFirst({ where: eq(farmerProfiles.userId, farmerUserId) });
  if (!profile) throw new RequestError("Farmer not found", 404);
  if (profile.kycStatus !== "pending") throw new RequestError("No KYC submission is waiting for a decision.", 409);
  if (decision === "rejected") {
    const reason = note?.trim() ?? "";
    if (reason.length < 3) throw new RequestError("Say why KYC is rejected.", 400);
    await db.update(farmerProfiles).set({ kycStatus: "rejected", kycNote: reason, kycDecidedBy: actor.id, kycDecidedAt: new Date(), updatedAt: new Date() }).where(eq(farmerProfiles.userId, farmerUserId));
    await audit(db, { actorUserId: actor.id, action: "farmer_kyc.reject", targetType: "user", targetId: farmerUserId, payload: { note: reason } });
    await notify(db, farmerUserId, "kyc", "Issuer KYC rejected", reason);
    return;
  }
  const ws = await db.select().from(wallets).where(eq(wallets.userId, farmerUserId));
  const wallet = (ws.find((w) => w.kind === "privy-embedded") ?? ws[0])?.address;
  if (!wallet) throw new RequestError("The farmer has no wallet yet. Ask them to sign in once so Privy creates it.", 409);
  await audited(db, { actorUserId: actor.id, action: "farmer_kyc.approve", targetType: "user", targetId: farmerUserId, payload: { wallet } }, () => chain.approveKyc(wallet), (s) => [s]);
  await db.update(farmerProfiles).set({ kycStatus: "approved", kycNote: null, kycDecidedBy: actor.id, kycDecidedAt: new Date(), updatedAt: new Date() }).where(eq(farmerProfiles.userId, farmerUserId));
  await notify(db, farmerUserId, "kyc", "Issuer KYC approved", "Your company can be the issuer of record of its pool.");
}

/** Investor KYC decision. Approval writes the platform KYC record for every linked wallet; later links are approved when linked. */
export async function decideInvestorKyc(db: Db, actor: SessionUser, investorUserId: string, decision: "approved" | "rejected", note: string | null, chain: ArrangerChain): Promise<void> {
  assertRole(actor, "arranger");
  assertUuid(investorUserId, "Investor");
  const profile = await db.query.investorProfiles.findFirst({ where: eq(investorProfiles.userId, investorUserId) });
  if (!profile) throw new RequestError("Investor not found", 404);
  if (profile.kycStatus !== "pending") throw new RequestError("No KYC submission is waiting for a decision.", 409);
  if (decision === "rejected") {
    const reason = note?.trim() ?? "";
    if (reason.length < 3) throw new RequestError("Say why KYC is rejected.", 400);
    await db.update(investorProfiles).set({ kycStatus: "rejected", kycNote: reason, decidedBy: actor.id, decidedAt: new Date(), updatedAt: new Date() }).where(eq(investorProfiles.userId, investorUserId));
    await audit(db, { actorUserId: actor.id, action: "investor_kyc.reject", targetType: "user", targetId: investorUserId, payload: { note: reason } });
    await notify(db, investorUserId, "kyc", "KYC rejected", reason);
    return;
  }
  const ws = await db.select().from(wallets).where(eq(wallets.userId, investorUserId));
  for (const w of ws) {
    await audited(db, { actorUserId: actor.id, action: "investor_kyc.approve", targetType: "user", targetId: investorUserId, payload: { wallet: w.address, category: profile.category } }, () => chain.approveKyc(w.address), (s) => [s]);
  }
  if (!ws.length) await audit(db, { actorUserId: actor.id, action: "investor_kyc.approve", targetType: "user", targetId: investorUserId, payload: { category: profile.category, wallet: null } });
  await db.update(investorProfiles).set({ kycStatus: "approved", kycNote: null, decidedBy: actor.id, decidedAt: new Date(), updatedAt: new Date() }).where(eq(investorProfiles.userId, investorUserId));
  await notify(db, investorUserId, "kyc", "KYC approved", "Accept a pool's key features document to subscribe.");
}

export async function verifyApplicationFields(db: Db, actor: SessionUser, id: string, chain: ArrangerChain): Promise<string[]> {
  assertRole(actor, "arranger");
  const app = await loadApplication(db, id);
  if (app.status !== "field_verification") throw new RequestError("Fields are verified during the field verification step.", 409);
  const project = app.projectAddress ? await chain.project(app.projectAddress) : null;
  if (!project) throw new RequestError("The farm project was not found on-chain.", 404);
  return audited(db, { actorUserId: actor.id, action: "fields.verify", targetType: "application", targetId: id, payload: { project: project.address } }, () => chain.verifyFields(project), (s) => s);
}

export const termsInput = z.object({
  poolId: z.string().regex(/^\d{1,20}$/).optional(),
  name: z.string().trim().min(1).max(32),
  symbol: z.string().trim().min(1).max(10),
  unitNominalUsd: z.number().int().min(1).max(100_000_000),
  couponBps: z.number().int().min(0).max(3_000),
  settlementMode: z.enum(SETTLEMENT_MODES),
  closeInMinutes: z.number().int().min(1).max(60 * 24 * 30),
  maturityInMinutes: z.number().int().min(2).max(60 * 24 * 365),
  arrangementFeeBps: z.number().int().min(0).max(10_000),
  premiumBps: z.number().int().min(500).max(600).default(500),
  interestDays: z.number().int().min(1).max(1_830).optional(),
});
export type TermsInput = z.input<typeof termsInput>;

/**
 * Term builder: creates the pool with InstrumentTerms (the farmer's wallet is the issuer of record) and adds the
 * farm project. A retry after a failed add reuses the pool already created.
 */
export async function structureApplication(db: Db, actor: SessionUser, id: string, input: TermsInput, chain: ArrangerChain): Promise<ApplicationRow> {
  assertRole(actor, "arranger");
  let app = await loadApplication(db, id);
  if (app.status !== "structuring") throw new RequestError("Terms are built during the structuring step.", 409);
  const t = parseOr400(termsInput, input);
  if ((app.requestedUsd % t.unitNominalUsd) !== 0) throw new RequestError(`The nominal must divide the requested amount (${app.requestedUsd} USD) into whole tokens.`, 400);
  const project = app.projectAddress ? await chain.project(app.projectAddress) : null;
  if (!project) throw new RequestError("The farm project was not found on-chain.", 404);
  if (project.pool) throw new RequestError("The farm project is already in a pool.", 409);
  if (!app.poolId) {
    const pool: CreatePoolInput = parseOr400(createPoolInput, {
      poolId: t.poolId ?? (await chain.nextPoolId()),
      crop: app.crop,
      season: app.season,
      name: t.name,
      symbol: t.symbol,
      yieldBps: Math.min(t.couponBps, 5_000),
      premiumBps: t.premiumBps,
      arrangementFeeBps: t.arrangementFeeBps,
      closeInMinutes: t.closeInMinutes,
      maturityInMinutes: t.maturityInMinutes,
      instrument: {
        issuerOfRecord: project.producer,
        unitNominalUsd: t.unitNominalUsd,
        couponBps: t.couponBps,
        settlementMode: t.settlementMode,
        volumeTonnes: app.volumeT,
        tokenizedShareBps: app.tokenizedShareBps,
        elevator: app.elevator,
        lab: app.lab,
        ...(t.interestDays ? { interestDays: t.interestDays } : {}),
      },
    });
    const created = await audited(db, { actorUserId: actor.id, action: "pool.create", targetType: "application", targetId: id, payload: { poolId: pool.poolId, symbol: pool.symbol } }, () => chain.createTermPool(pool), (r) => [r.signature]);
    [app] = (await db.update(applications).set({ poolId: created.poolId, poolAddress: created.poolAddress, updatedAt: new Date() }).where(eq(applications.id, id)).returning()) as [ApplicationRow];
  }
  const poolId = app.poolId as string;
  await audited(db, { actorUserId: actor.id, action: "pool.add_project", targetType: "application", targetId: id, payload: { poolId, project: project.address } }, () => chain.addProject(poolId, project.address), (s) => [s]);
  const row = await setStatus(db, app, "ready");
  await audit(db, { actorUserId: actor.id, action: "application.advance", targetType: "application", targetId: id, payload: { from: "structuring", to: "ready" } });
  return row;
}

export async function publishApplication(db: Db, actor: SessionUser, id: string, chain: ArrangerChain): Promise<ApplicationRow> {
  assertRole(actor, "arranger");
  const app = await loadApplication(db, id);
  if (app.status !== "ready" || !app.poolId) throw new RequestError("Only a ready application with a pool can be published.", 409);
  const poolId = app.poolId;
  await audited(db, { actorUserId: actor.id, action: "pool.open", targetType: "application", targetId: id, payload: { poolId } }, () => chain.openPool(poolId), (s) => [s]);
  return setStatus(db, app, "open");
}

const TERMINAL: ApplicationStatus[] = ["rejected", "withdrawn", "closed"];

/** Derives statuses from chain state for every application with a pool and caches changes. Returns how many changed. */
export async function refreshChainStatuses(db: Db, chain: Pick<ArrangerChain, "pool">, nowSec: number): Promise<number> {
  const rows = await db.select().from(applications).where(and(isNotNull(applications.poolId), notInArray(applications.status, TERMINAL)));
  let changed = 0;
  for (const app of rows) {
    const detail = await chain.pool(app.poolId as string).catch(() => null);
    if (!detail) continue;
    const derived = deriveFromChain(detail, nowSec);
    if (derived && derived !== app.status) {
      await setStatus(db, app, derived);
      await audit(db, { actorUserId: null, action: "application.chain_status", targetType: "application", targetId: app.id, payload: { from: app.status, to: derived } });
      changed++;
    }
  }
  return changed;
}

export interface InvestorQueueRow {
  userId: string;
  email: string;
  profile: InvestorProfileRow;
  wallets: string[];
}

export async function investorQueue(db: Db, statuses: InvestorProfileRow["kycStatus"][] = ["pending"]): Promise<InvestorQueueRow[]> {
  const rows = await db
    .select({ profile: investorProfiles, email: users.email })
    .from(investorProfiles)
    .innerJoin(users, eq(users.id, investorProfiles.userId))
    .where(inArray(investorProfiles.kycStatus, statuses))
    .orderBy(desc(investorProfiles.updatedAt));
  const ws = rows.length ? await db.select().from(wallets).where(inArray(wallets.userId, rows.map((r) => r.profile.userId))) : [];
  return rows.map((r) => ({ userId: r.profile.userId, email: r.email, profile: r.profile, wallets: ws.filter((w) => w.userId === r.profile.userId).map((w) => w.address) }));
}

export async function farmerKycQueue(db: Db) {
  return db
    .select({ profile: farmerProfiles, email: users.email })
    .from(farmerProfiles)
    .innerJoin(users, eq(users.id, farmerProfiles.userId))
    .where(eq(farmerProfiles.kycStatus, "pending"));
}
