import { PILOT_QUALITY_SPEC, poolPda, type F2f } from "@f2f/sdk";
import type { Program } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import { storeQualitySpec } from "../pilot-docs";
import { verifyAllFields, type StubDeps } from "../scas-stub";
import type { BlobStore } from "../store";
import type { ArrangerChain } from "../workflow/ports";
import { RequestError } from "../errors";
import { addProject, approveInvestor, createPool, nextPoolId, openPool, revokeInvestor, type OpsContext } from "./admin-ops";
import { instrumentAta } from "./ix";
import { fieldsOfProject } from "./filters";
import { toFieldView, toProjectView, type PoolDetail } from "./views";

export interface ArrangerChainDeps {
  program: Program<F2f>;
  ops: () => OpsContext;
  stub: () => StubDeps;
  store: () => BlobStore;
  publicBaseUrl: string;
  getPool(poolId: string): Promise<PoolDetail | null>;
  /** Called after every transaction (the server clears its read cache). */
  afterTx?: () => void;
}

/** ArrangerChain over the role keys: compliance approves KYC, the SCAS stub verifies, the Issuer creates and opens pools. */
export function makeArrangerChain(d: ArrangerChainDeps): ArrangerChain {
  const tx = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } finally {
      d.afterTx?.();
    }
  };
  return {
    approveKyc: (wallet) =>
      tx(async () => {
        const ctx = d.ops();
        const key = new PublicKey(wallet);
        // Approval is platform-level and permanent until revoked: a repeat costs nothing.
        if (await ctx.isKycApproved(key)) return null;
        return approveInvestor(ctx, key);
      }),
    revokeKyc: (wallet) =>
      tx(async () => {
        const ctx = d.ops();
        const key = new PublicKey(wallet);
        const pools = (await d.program.account.pool.all()).sort((a, b) => a.account.poolId.cmp(b.account.poolId));
        if (!pools.length) throw new RequestError("No pool exists to record the revocation against.", 409);
        const held: bigint[] = [];
        for (const p of pools) if (await ctx.accountExists(instrumentAta(p.account.mint, key))) held.push(BigInt(p.account.poolId.toString()));
        // revoke_investor takes a pool to freeze in; with no holdings any pool records the revocation.
        const targets = held.length ? held : [BigInt((pools[0] as (typeof pools)[number]).account.poolId.toString())];
        const signatures: string[] = [];
        for (const id of targets) signatures.push(await revokeInvestor(ctx, id, key));
        return signatures;
      }),
    project: async (address) => {
      const key = new PublicKey(address);
      const account = await d.program.account.farmProject.fetchNullable(key);
      if (!account) return null;
      const fields = await d.program.account.field.all([fieldsOfProject(key)]);
      return { ...toProjectView(key, account), fields: fields.map((f) => toFieldView(f.publicKey, f.account)).sort((a, b) => a.index - b.index) };
    },
    verifyFields: (project) =>
      tx(async () => {
        const r = await verifyAllFields(d.stub(), [project]);
        if (r.failures.length) throw new Error(`${r.results.length} verified, ${r.failures.length} failed: ${r.failures[0]?.error}`);
        return r.results.map((x) => x.signature);
      }),
    createTermPool: (input) =>
      tx(async () => {
        // ADR 0014: the quality spec JSON is stored before the transaction that records its hash.
        const spec = await storeQualitySpec(d.store(), PILOT_QUALITY_SPEC, d.publicBaseUrl);
        const r = await createPool(d.ops(), input, d.publicBaseUrl, spec);
        return { poolId: r.poolId, poolAddress: poolPda(d.program.programId, BigInt(r.poolId)).toBase58(), signature: r.signature };
      }),
    addProject: (poolId, project) => tx(() => addProject(d.ops(), BigInt(poolId), new PublicKey(project))),
    openPool: (poolId) => tx(() => openPool(d.ops(), BigInt(poolId))),
    pool: (poolId) => d.getPool(poolId),
    nextPoolId: async () => nextPoolId((await d.program.account.pool.all()).map((p) => p.account.poolId.toString())),
  };
}
