"use server";

import * as Sentry from "@sentry/nextjs";
import { PublicKey } from "@solana/web3.js";
import { PILOT_QUALITY_SPEC, VERDICTS, type AttestationKindName, type VerdictName } from "@f2f/sdk";
import {
  adminMintUsdc,
  addProject,
  approveInvestor,
  closeSubscription,
  createPool,
  createPoolInput,
  disburseAll,
  electSettlement,
  fundRedemption,
  recordDelivery,
  openPool,
  recordSettlement,
  revokeInvestor,
  sweep,
} from "@/lib/chain/admin-ops";
import { SETTLEMENT_RULES, type SettlementRuleName } from "@/lib/chain/enums";
import { explainChainError, type ExplainedError } from "@/lib/chain/explain";
import { ChainTxError } from "@/lib/chain/send";
import { RequestError } from "@/lib/errors";
import { formatUsd } from "@/lib/format";
import { seasonAttestationBlocker } from "@/lib/pool-math";
import { attestStage, verifyAllFields } from "@/lib/scas-stub";
import {
  FARMER_REQUIREMENTS,
  onboardingStatus,
  readOnboarding,
  recordOnboardingDocument,
  storeDeliveryEvidence,
  storeDocument,
  storeFieldSet,
  storeQualitySpec,
  type FieldSetEntry,
  type RequirementKey,
  type RequirementRow,
} from "@/lib/pilot-docs";
import { getReader, getStore, invalidateReads, opsContext, stubDeps } from "@/lib/server/context";
import { serverEnv } from "@/lib/server/env";
import type { SessionUser } from "@/lib/auth/session";
import type { Db } from "@/lib/db/client";
import { requireActionRole } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { refreshStatuses } from "@/lib/server/status-refresh";
import { audit } from "@/lib/workflow/audit";

export type ActionResult = { ok: true; message: string; signatures: string[] } | { ok: false; error: ExplainedError; logs: string[] };

/** What the audit log records for an action: the action name and what it acted on. */
type AuditMeta = { action: string; targetType: string; targetId: string; payload?: Record<string, unknown> };

/**
 * Every arranger action: role guard first (Postgres-backed, per request), then the work, then an audit row with the
 * signatures or the error. Chain-derived application statuses are refreshed afterwards.
 */
async function run(meta: AuditMeta, fn: () => Promise<{ message: string; signatures: string[] }>): Promise<ActionResult> {
  let actor: SessionUser | null = null;
  let db: Db | null = null;
  try {
    actor = await requireActionRole("arranger");
    db = await getDb();
    const r = await fn();
    await audit(db, { ...meta, actorUserId: actor.id, signatures: r.signatures, payload: { ...meta.payload, message: r.message } });
    return { ok: true, ...r };
  } catch (e) {
    if (actor && db) await audit(db, { ...meta, actorUserId: actor.id, error: e instanceof Error ? e.message : String(e) }).catch(() => {});
    if (e instanceof RequestError) return { ok: false, error: { code: "BadRequest", title: e.message, detail: "", action: "none" }, logs: [] };
    if (e instanceof ChainTxError) return { ok: false, error: explainChainError({ logs: e.logs, error: e }), logs: e.logs };
    Sentry.captureException(e);
    return { ok: false, error: explainChainError({ error: e }), logs: [] };
  } finally {
    invalidateReads();
    if (db) await refreshStatuses(db, true);
  }
}

/** Guard for the non-transaction helpers (checklist, uploads, field sets): same role check, plain error text. */
async function guard(): Promise<SessionUser> {
  return requireActionRole("arranger");
}

const id = (poolId: string) => {
  if (!/^\d{1,20}$/.test(poolId)) throw new RequestError("Invalid pool id", 400);
  return BigInt(poolId);
};

const pool = (poolId: string, action: string, payload?: Record<string, unknown>): AuditMeta => ({ action, targetType: "pool", targetId: poolId, payload });

export const createPoolAction = async (input: unknown) =>
  run({ action: "pool.create", targetType: "pool", targetId: String((input as { poolId?: unknown } | null)?.poolId ?? "new") }, async () => {
    const parsed = createPoolInput.safeParse(input);
    if (!parsed.success) throw new RequestError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 400);
    const base = serverEnv().PUBLIC_BASE_URL;
    // ADR 0014: the quality spec JSON is stored before the transaction that records its hash.
    const spec = parsed.data.instrument ? await storeQualitySpec(getStore(), PILOT_QUALITY_SPEC, base) : undefined;
    const r = await createPool(opsContext(), parsed.data, base, spec);
    return { message: `Pool ${r.poolId} created as Draft${spec ? " with term-sheet terms" : ""}`, signatures: [r.signature] };
  });

export const addProjectAction = async (poolId: string, project: string) =>
  run(pool(poolId, "pool.add_project", { project }), async () => ({ message: "Project added to the pool", signatures: [await addProject(opsContext(), id(poolId), new PublicKey(project))] }));

export const openPoolAction = async (poolId: string) =>
  run(pool(poolId, "pool.open"), async () => ({ message: "Pool is open for subscription", signatures: [await openPool(opsContext(), id(poolId))] }));

export const closeSubscriptionAction = async (poolId: string) =>
  run(pool(poolId, "pool.close_subscription"), async () => ({ message: "Subscription closed", signatures: [await closeSubscription(opsContext(), id(poolId))] }));

export const disburseAllAction = async (poolId: string) =>
  run(pool(poolId, "pool.disburse"), async () => {
    const signatures = await disburseAll(opsContext(), id(poolId));
    return { message: signatures.length ? `Paid ${signatures.length} project(s)` : "Every project was already paid", signatures };
  });

export const verifyAllFieldsAction = async () =>
  run({ action: "fields.verify_all", targetType: "fields", targetId: "unpooled" }, async () => {
    const r = await verifyAllFields(stubDeps(), await getReader().unpooledProjects());
    if (r.failures.length) throw new RequestError(`${r.results.length} verified, ${r.failures.length} failed: ${r.failures[0]?.error}`, 502);
    return { message: r.results.length ? `Verified ${r.results.length} field(s) with the SCAS stub` : "No unverified fields", signatures: r.results.map((x) => x.signature) };
  });

const STAGES = ["Sowing", "Vegetation", "Harvest"] as const;
export const attestStageAction = async (poolId: string, kind: (typeof STAGES)[number]) =>
  run(pool(poolId, "pool.attest_stage", { kind }), async () => {
    if (!STAGES.includes(kind)) throw new RequestError("Unknown season stage", 400);
    const detail = await getReader().getPool(poolId);
    if (!detail) throw new RequestError(`Pool ${poolId} does not exist`, 404);
    const blocked = seasonAttestationBlocker(detail.pool.status, detail.projects.length);
    if (blocked) throw new RequestError(blocked, 409);
    const r = await attestStage(stubDeps(), detail.projects, kind as Exclude<AttestationKindName, "FieldVerified">);
    if (r.failures.length) throw new RequestError(`${r.results.length} attested, ${r.failures.length} failed: ${r.failures[0]?.error}`, 502);
    return { message: `${kind} attested for ${r.results.length} field(s)`, signatures: r.results.map((x) => x.signature) };
  });

export const recordSettlementAction = async (poolId: string, project: string, rule: string) =>
  run(pool(poolId, "pool.record_settlement", { project, rule }), async () => {
    if (!(SETTLEMENT_RULES as readonly string[]).includes(rule)) throw new RequestError("Unknown settlement rule", 400);
    return {
      message: "Settlement recorded",
      signatures: [await recordSettlement(opsContext(), id(poolId), new PublicKey(project), rule as SettlementRuleName)],
    };
  });

export const fundRedemptionAction = async (poolId: string) =>
  run(pool(poolId, "pool.fund_redemption"), async () => {
    const r = await fundRedemption(opsContext(), id(poolId));
    const when = r.maturityPassed ? "Redemption check ran." : "Maturity has not passed yet; run this again after maturity to open redemption.";
    return { message: `Deposited ${formatUsd(r.deposited)} of ${formatUsd(r.required)}. ${when}`, signatures: r.signatures };
  });

export const sweepAction = async (poolId: string) =>
  run(pool(poolId, "pool.sweep"), async () => ({ message: "Vault remainder returned to the Issuer", signatures: [await sweep(opsContext(), id(poolId))] }));

export const approveInvestorAction = async (wallet: string) =>
  run({ action: "investor_kyc.approve_wallet", targetType: "wallet", targetId: wallet }, async () => ({ message: "Investor approved for every pool; accounts thaw on first subscription", signatures: [await approveInvestor(opsContext(), new PublicKey(wallet))] }));

export const revokeInvestorAction = async (poolId: string, wallet: string) =>
  run({ action: "investor_kyc.revoke", targetType: "wallet", targetId: wallet, payload: { poolId } }, async () => ({ message: "Investor revoked; account frozen", signatures: [await revokeInvestor(opsContext(), id(poolId), new PublicKey(wallet))] }));

// ---- Term-sheet instruments (ADR 0014) ----

export const electSettlementAction = async (poolId: string, election: string) =>
  run(pool(poolId, "pool.elect_settlement", { election }), async () => {
    if (election !== "Buyback" && election !== "Delivery") throw new RequestError("Unknown election", 400);
    return { message: `Settlement elected: ${election === "Buyback" ? "issuer buyback" : "grain delivery"}`, signatures: [await electSettlement(opsContext(), id(poolId), election)] };
  });

const fileBytes = async (form: FormData, name: string): Promise<{ bytes: Uint8Array; type: string }> => {
  const f = form.get(name);
  if (!(f instanceof File) || f.size === 0) throw new RequestError("Choose a file", 400);
  return { bytes: new Uint8Array(await f.arrayBuffer()), type: f.type };
};

/** Stores the receipt or certificate (admin-only), its evidence JSON (public past basic auth), then records the attestation. */
export const recordDeliveryAction = async (poolId: string, form: FormData) =>
  run(pool(poolId, "pool.record_delivery", { kind: String(form.get("kind")) }), async () => {
    const kind = String(form.get("kind"));
    const verdict = String(form.get("verdict"));
    if (kind !== "ElevatorReceipt" && kind !== "LabQuality") throw new RequestError("Unknown delivery document", 400);
    if (!(VERDICTS as readonly string[]).includes(verdict)) throw new RequestError("Unknown verdict", 400);
    const kgRaw = String(form.get("tonnes") ?? "").trim();
    if (kgRaw && !/^\d{1,9}$/.test(kgRaw)) throw new RequestError("Tonnes must be a whole number", 400);
    const { bytes, type } = await fileBytes(form, "file");
    const store = getStore();
    const doc = await storeDocument(store, bytes, type);
    const evidence = await storeDeliveryEvidence(
      store,
      { kind, verdict: verdict as VerdictName, poolId, documentSha256: doc.sha256, ...(kgRaw ? { kg: (BigInt(kgRaw) * 1000n).toString() } : {}) },
      serverEnv().PUBLIC_BASE_URL,
      Math.floor(Date.now() / 1000),
    );
    const signature = await recordDelivery(opsContext(), id(poolId), { kind, verdict: verdict as VerdictName, evidenceHash: evidence.hash, evidenceUri: evidence.uri });
    return { message: `${kind === "ElevatorReceipt" ? "Elevator receipt" : "Lab certificate"} recorded`, signatures: [signature] };
  });

export const adminMintUsdcAction = async (wallet: string, usd: number) =>
  run({ action: "treasury.mint_test_usdc", targetType: "wallet", targetId: wallet, payload: { usd } }, async () => {
    const signature = await adminMintUsdc(opsContext(), new PublicKey(wallet), usd);
    return { message: `Minted ${formatUsd(BigInt(usd) * 1_000_000n)} of test USDC`, signatures: [signature] };
  });

export type OnboardingResult = { ok: true; rows: RequirementRow[] } | { ok: false; error: string };

export async function onboardingStatusAction(wallet: string): Promise<OnboardingResult> {
  try {
    await guard();
    const key = new PublicKey(wallet);
    const [manifest, investor] = await Promise.all([readOnboarding(getStore(), key.toBase58()), getReader().investor(key.toBase58())]);
    return { ok: true, rows: onboardingStatus(manifest, investor.approved) };
  } catch (e) {
    return { ok: false, error: e instanceof RequestError ? e.message : "Could not load the checklist. Check the wallet address." };
  }
}

export async function uploadOnboardingDocumentAction(form: FormData): Promise<OnboardingResult> {
  try {
    await guard();
    const wallet = new PublicKey(String(form.get("wallet"))).toBase58();
    const requirement = String(form.get("requirement")) as RequirementKey;
    if (!FARMER_REQUIREMENTS.some((r) => r.key === requirement)) throw new RequestError("Unknown requirement", 400);
    const { bytes, type } = await fileBytes(form, "file");
    const manifest = await recordOnboardingDocument(getStore(), wallet, requirement, bytes, type, Math.floor(Date.now() / 1000));
    const investor = await getReader().investor(wallet);
    return { ok: true, rows: onboardingStatus(manifest, investor.approved) };
  } catch (e) {
    return { ok: false, error: e instanceof RequestError ? e.message : "Upload failed. Try again." };
  }
}

export type FieldSetResult = { ok: true; hash: string } | { ok: false; error: string };

/** Imported fields with cadastral numbers, kept in the bucket only (never on-chain, never in the repo). */
export async function saveFieldSetAction(fields: FieldSetEntry[]): Promise<FieldSetResult> {
  try {
    await guard();
    return { ok: true, ...(await storeFieldSet(getStore(), fields)) };
  } catch (e) {
    return { ok: false, error: e instanceof RequestError ? e.message : "Could not save the field set." };
  }
}
