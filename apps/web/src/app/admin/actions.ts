"use server";

import * as Sentry from "@sentry/nextjs";
import { PublicKey } from "@solana/web3.js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AttestationKindName } from "@f2f/sdk";
import { ADMIN_COOKIE, adminToken, isAdminToken, passwordMatches } from "@/lib/admin-auth";
import {
  addProject,
  approveInvestor,
  closeSubscription,
  createPool,
  createPoolInput,
  disburseAll,
  fundRedemption,
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
import { attestStage, verifyAllFields } from "@/lib/scas-stub";
import { getReader, invalidateReads, opsContext, stubDeps } from "@/lib/server/context";
import { serverEnv } from "@/lib/server/env";

export type ActionResult = { ok: true; message: string; signatures: string[] } | { ok: false; error: ExplainedError; logs: string[] };

async function requireAdmin(): Promise<void> {
  const jar = await cookies();
  if (!isAdminToken(serverEnv().ADMIN_PASSWORD, jar.get(ADMIN_COOKIE)?.value)) {
    throw new RequestError("Your demo console session expired. Sign in again.", 401);
  }
}

async function run(fn: () => Promise<{ message: string; signatures: string[] }>): Promise<ActionResult> {
  try {
    await requireAdmin();
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, error: { code: "BadRequest", title: e.message, detail: "", action: "none" }, logs: [] };
    if (e instanceof ChainTxError) return { ok: false, error: explainChainError({ logs: e.logs, error: e }), logs: e.logs };
    Sentry.captureException(e);
    return { ok: false, error: explainChainError({ error: e }), logs: [] };
  } finally {
    invalidateReads();
  }
}

const id = (poolId: string) => {
  if (!/^\d{1,20}$/.test(poolId)) throw new RequestError("Invalid pool id", 400);
  return BigInt(poolId);
};

export async function loginAction(_prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const password = serverEnv().ADMIN_PASSWORD;
  if (!password) return { error: "The demo console is disabled: ADMIN_PASSWORD is not set." };
  if (!passwordMatches(password, String(form.get("password") ?? ""))) return { error: "Wrong password." };
  (await cookies()).set(ADMIN_COOKIE, adminToken(password), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 3600,
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export const createPoolAction = async (input: unknown) =>
  run(async () => {
    const parsed = createPoolInput.safeParse(input);
    if (!parsed.success) throw new RequestError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 400);
    const r = await createPool(opsContext(), parsed.data, serverEnv().PUBLIC_BASE_URL);
    return { message: `Pool ${r.poolId} created as Draft`, signatures: [r.signature] };
  });

export const addProjectAction = async (poolId: string, project: string) =>
  run(async () => ({ message: "Project added to the pool", signatures: [await addProject(opsContext(), id(poolId), new PublicKey(project))] }));

export const openPoolAction = async (poolId: string) =>
  run(async () => ({ message: "Pool is open for subscription", signatures: [await openPool(opsContext(), id(poolId))] }));

export const closeSubscriptionAction = async (poolId: string) =>
  run(async () => ({ message: "Subscription closed", signatures: [await closeSubscription(opsContext(), id(poolId))] }));

export const disburseAllAction = async (poolId: string) =>
  run(async () => {
    const signatures = await disburseAll(opsContext(), id(poolId));
    return { message: signatures.length ? `Paid ${signatures.length} project(s)` : "Every project was already paid", signatures };
  });

export const verifyAllFieldsAction = async () =>
  run(async () => {
    const r = await verifyAllFields(stubDeps(), await getReader().unpooledProjects());
    if (r.failures.length) throw new RequestError(`${r.results.length} verified, ${r.failures.length} failed: ${r.failures[0]?.error}`, 502);
    return { message: r.results.length ? `Verified ${r.results.length} field(s) with the SCAS stub` : "No unverified fields", signatures: r.results.map((x) => x.signature) };
  });

const STAGES = ["Sowing", "Vegetation", "Harvest"] as const;
export const attestStageAction = async (poolId: string, kind: (typeof STAGES)[number]) =>
  run(async () => {
    if (!STAGES.includes(kind)) throw new RequestError("Unknown season stage", 400);
    const detail = await getReader().getPool(poolId);
    if (!detail) throw new RequestError(`Pool ${poolId} does not exist`, 404);
    const r = await attestStage(stubDeps(), detail.projects, kind as Exclude<AttestationKindName, "FieldVerified">);
    if (r.failures.length) throw new RequestError(`${r.results.length} attested, ${r.failures.length} failed: ${r.failures[0]?.error}`, 502);
    return { message: `${kind} attested for ${r.results.length} field(s)`, signatures: r.results.map((x) => x.signature) };
  });

export const recordSettlementAction = async (poolId: string, project: string, rule: string) =>
  run(async () => {
    if (!(SETTLEMENT_RULES as readonly string[]).includes(rule)) throw new RequestError("Unknown settlement rule", 400);
    return {
      message: "Settlement recorded",
      signatures: [await recordSettlement(opsContext(), id(poolId), new PublicKey(project), rule as SettlementRuleName)],
    };
  });

export const fundRedemptionAction = async (poolId: string) =>
  run(async () => {
    const r = await fundRedemption(opsContext(), id(poolId));
    const when = r.maturityPassed ? "Redemption check ran." : "Maturity has not passed yet; run this again after maturity to open redemption.";
    return { message: `Deposited ${formatUsd(r.deposited)} of ${formatUsd(r.required)}. ${when}`, signatures: r.signatures };
  });

export const sweepAction = async (poolId: string) =>
  run(async () => ({ message: "Vault remainder returned to the Issuer", signatures: [await sweep(opsContext(), id(poolId))] }));

export const approveInvestorAction = async (wallet: string) =>
  run(async () => ({ message: "Investor approved for every pool; accounts thaw on first subscription", signatures: [await approveInvestor(opsContext(), new PublicKey(wallet))] }));

export const revokeInvestorAction = async (poolId: string, wallet: string) =>
  run(async () => ({ message: "Investor revoked; account frozen", signatures: [await revokeInvestor(opsContext(), id(poolId), new PublicKey(wallet))] }));
