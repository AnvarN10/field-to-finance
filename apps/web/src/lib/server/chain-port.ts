import "server-only";
import { PILOT_QUALITY_SPEC, poolPda } from "@f2f/sdk";
import { PublicKey } from "@solana/web3.js";
import { addProject, approveInvestor, createPool, nextPoolId, openPool } from "../chain/admin-ops";
import { fieldsOfProject } from "../chain/filters";
import { toFieldView, toProjectView } from "../chain/views";
import { storeQualitySpec } from "../pilot-docs";
import { verifyAllFields } from "../scas-stub";
import type { ArrangerChain } from "../workflow/ports";
import { getBuildProgram, getReader, getStore, invalidateReads, opsContext, stubDeps } from "./context";
import { serverEnv } from "./env";

async function fresh<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } finally {
    invalidateReads();
  }
}

/** ArrangerChain over the server-held role keys (compliance, Issuer, SCAS stub). */
export function arrangerChain(): ArrangerChain {
  return {
    approveKyc: (wallet) =>
      fresh(async () => {
        const ctx = opsContext();
        const key = new PublicKey(wallet);
        // Approval is platform-level and permanent until revoked: a repeat costs nothing.
        if (await ctx.isKycApproved(key)) return null;
        return approveInvestor(ctx, key);
      }),
    project: async (address) => {
      const program = getBuildProgram();
      const key = new PublicKey(address);
      const account = await program.account.farmProject.fetchNullable(key);
      if (!account) return null;
      const fields = await program.account.field.all([fieldsOfProject(key)]);
      return { ...toProjectView(key, account), fields: fields.map((f) => toFieldView(f.publicKey, f.account)).sort((a, b) => a.index - b.index) };
    },
    verifyFields: (project) =>
      fresh(async () => {
        const r = await verifyAllFields(stubDeps(), [project]);
        if (r.failures.length) throw new Error(`${r.results.length} verified, ${r.failures.length} failed: ${r.failures[0]?.error}`);
        return r.results.map((x) => x.signature);
      }),
    createTermPool: (input) =>
      fresh(async () => {
        const base = serverEnv().PUBLIC_BASE_URL;
        // ADR 0014: the quality spec JSON is stored before the transaction that records its hash.
        const spec = await storeQualitySpec(getStore(), PILOT_QUALITY_SPEC, base);
        const r = await createPool(opsContext(), input, base, spec);
        return { poolId: r.poolId, poolAddress: poolPda(getBuildProgram().programId, BigInt(r.poolId)).toBase58(), signature: r.signature };
      }),
    addProject: (poolId, project) => fresh(() => addProject(opsContext(), BigInt(poolId), new PublicKey(project))),
    openPool: (poolId) => fresh(() => openPool(opsContext(), BigInt(poolId))),
    pool: (poolId) => getReader().getPool(poolId),
    nextPoolId: async () => nextPoolId((await getReader().listPools()).map((p) => p.poolId)),
  };
}
