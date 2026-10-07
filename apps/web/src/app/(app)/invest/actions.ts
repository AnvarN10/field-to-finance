"use server";

import * as Sentry from "@sentry/nextjs";
import type { SessionUser } from "@/lib/auth/session";
import type { Db } from "@/lib/db/client";
import { RequestError } from "@/lib/errors";
import { buildKfd, kfdHash } from "@/lib/kfd";
import { requireAccount } from "@/lib/server/auth";
import { arrangerChain } from "@/lib/server/chain-port";
import { getReader } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import { verifyWalletLink } from "@/lib/wallet-link";
import { acceptKfd, acknowledgeRisk, linkWallet, saveQuestionnaire, submitInvestorKyc } from "@/lib/workflow/investor";

export type InvestorResult = { ok: true } | { ok: false; error: string };

async function act(fn: (user: SessionUser, db: Db) => Promise<unknown>): Promise<InvestorResult> {
  try {
    const user = await requireAccount("investor");
    await fn(user, await getDb());
    return { ok: true };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, error: e.message };
    Sentry.captureException(e);
    return { ok: false, error: "Something went wrong. Try again in a minute." };
  }
}

export const saveQuestionnaireAction = async (input: unknown) => act((user, db) => saveQuestionnaire(db, user, input));
export const submitKycAction = async (input: unknown) => act((user, db) => submitInvestorKyc(db, user, input));
export const acknowledgeRiskAction = async () => act((user, db) => acknowledgeRisk(db, user));

/** Links a Phantom (or other Wallet Standard) wallet after checking its signature over the link message. */
export const linkPhantomAction = async (address: string, message: string, signature: string) =>
  act(async (user, db) => {
    if (!verifyWalletLink({ userId: user.id, wallet: address, message, signature, nowMs: Date.now() })) {
      throw new RequestError("The signature does not match this wallet. Sign the message again.", 400);
    }
    // An investor approved before linking gets the new wallet approved on-chain at once.
    await linkWallet(db, user, { address, kind: "phantom" }, arrangerChain());
  });

/** The hash is computed here from the pool's on-chain terms, never taken from the browser. */
export const acceptKfdAction = async (poolId: string) =>
  act(async (user, db) => {
    if (!/^\d{1,20}$/.test(poolId)) throw new RequestError("Invalid pool id", 400);
    const [detail, fees] = await Promise.all([getReader().getPool(poolId), getReader().fees().catch(() => null)]);
    if (!detail) throw new RequestError(`Pool ${poolId} does not exist`, 404);
    await acceptKfd(db, user, detail.pool.address, kfdHash(buildKfd(detail, fees?.networkFee ?? null)));
  });
