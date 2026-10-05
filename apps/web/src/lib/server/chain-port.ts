import "server-only";
import { makeArrangerChain } from "../chain/arranger-chain";
import type { ArrangerChain } from "../workflow/ports";
import { getBuildProgram, getReader, getStore, invalidateReads, opsContext, stubDeps } from "./context";
import { serverEnv } from "./env";

/** ArrangerChain over the server-held role keys (compliance, Issuer, SCAS stub). */
export function arrangerChain(): ArrangerChain {
  return makeArrangerChain({
    program: getBuildProgram(),
    ops: opsContext,
    stub: stubDeps,
    store: getStore,
    publicBaseUrl: serverEnv().PUBLIC_BASE_URL,
    getPool: (poolId) => getReader().getPool(poolId),
    afterTx: invalidateReads,
  });
}
