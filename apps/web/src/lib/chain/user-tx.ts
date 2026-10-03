import type { Program } from "@anchor-lang/core";
import { projectPda, type F2f } from "@f2f/sdk";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { z } from "zod";
import { RequestError } from "../errors";
import { HEX64, polygonKey, type BlobStore } from "../store";
import { createUsdcAtaIx, redeemIx, refundIx, registerFieldIx, registerProjectIx, subscribeIx } from "./ix";
import type { PoolView } from "./views";

export const TX_ACTIONS = ["register-project", "subscribe", "refund", "redeem"] as const;
export type TxAction = (typeof TX_ACTIONS)[number];

const pubkey = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "must be a base58 public key");
const positive = z
  .string()
  .regex(/^\d{1,20}$/, "must be a whole number of base units")
  .transform((v) => BigInt(v))
  .refine((v) => v > 0n, "must be above zero");
const poolId = z.string().regex(/^\d{1,20}$/, "must be a pool id");

const registerProject = z.object({
  signer: pubkey,
  crop: z.string().trim().min(1).max(16),
  season: z.number().int().min(2025).max(2100),
  expectedKg: positive,
  requestedAmount: positive,
  fields: z
    .array(z.object({ polygonHash: z.string().regex(HEX64), areaHaX100: z.number().int().positive().max(4_294_967_295) }))
    .min(1)
    .max(4),
});
const holder = z.object({ signer: pubkey, poolId, amount: positive });

export interface UserTxDeps {
  program: Program<F2f>;
  store: BlobStore;
  usdcMint: PublicKey;
  getPool(poolId: string): Promise<PoolView | null>;
  now?: () => number;
}

export interface BuiltUserTx {
  payer: PublicKey;
  instructions: TransactionInstruction[];
  meta: Record<string, string>;
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new RequestError(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 400);
  return r.data;
}

export async function buildUserTx(deps: UserTxDeps, action: TxAction, body: unknown): Promise<BuiltUserTx> {
  const { program } = deps;
  if (action === "register-project") {
    const b = parse(registerProject, body);
    for (const [i, f] of b.fields.entries()) {
      if (!(await deps.store.get(polygonKey(f.polygonHash)))) {
        throw new RequestError(`Field ${i + 1} boundary was not uploaded. Upload the GeoJSON again.`, 422);
      }
    }
    const producer = new PublicKey(b.signer);
    // Unique per producer for a demo; the project PDA includes the producer key.
    const projectId = BigInt((deps.now ?? Date.now)());
    const project = projectPda(program.programId, producer, projectId);
    const instructions = [
      await registerProjectIx(program, { producer, projectId, crop: b.crop, season: b.season, expectedKg: b.expectedKg, requestedAmount: b.requestedAmount }),
      ...(await Promise.all(
        b.fields.map((f, index) => registerFieldIx(program, { producer, project, index, polygonHash: f.polygonHash, areaHaX100: f.areaHaX100 })),
      )),
    ];
    return { payer: producer, instructions, meta: { projectId: projectId.toString(), project: project.toBase58() } };
  }

  const b = parse(holder, body);
  const pool = await deps.getPool(b.poolId);
  if (!pool) throw new RequestError(`Pool ${b.poolId} does not exist`, 404);
  const investor = new PublicKey(b.signer);
  const args = {
    investor,
    pool: new PublicKey(pool.address),
    mint: new PublicKey(pool.mint),
    vault: new PublicKey(pool.vault),
    usdcMint: deps.usdcMint,
    amount: b.amount,
  };
  if (action === "subscribe") {
    // ADR 0011: subscribe creates and thaws the Instrument account itself. A wallet without an approved
    // InvestorRecord fails with AccountNotInitialized or InvestorNotApproved: the demo beat.
    return { payer: investor, instructions: [await subscribeIx(program, args)], meta: { poolId: b.poolId } };
  }
  const ix = action === "refund" ? await refundIx(program, args) : await redeemIx(program, args);
  return { payer: investor, instructions: [createUsdcAtaIx(investor, investor, deps.usdcMint), ix], meta: { poolId: b.poolId } };
}
