import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { effectiveElection } from "@f2f/sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import { closeSubscription, disburseAll, fundRedemption, recordSettlement, sweep } from "../chain/admin-ops";
import { makeArrangerChain } from "../chain/arranger-chain";
import { createUsdcAtaIx, electSettlementIx, fundRedemptionIx, mintUsdcIx, redeemDeliveryIx, redeemIx, subscribeIx, usdcAta } from "../chain/ix";
import { isProductionDb } from "../auth/session";
import { createPgDb } from "../db/client";
import { storeDocument, storeFieldSet } from "../pilot-docs";
import { ephemeralDb, registerDemoFields } from "./cabinet-flow-env";
import { createDemoContext } from "./context";
import { runLifecycleFlow } from "./lifecycle-flow";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Fresh farmer and investor keypairs, kept in DEMO_KEYS_FILE (outside the repo) so a stopped walk can be finished by hand. */
async function walkKeys(file: string | undefined): Promise<{ farmer: Keypair; investor: Keypair }> {
  const farmer = Keypair.generate();
  const investor = Keypair.generate();
  if (file) await writeFile(file, JSON.stringify({ farmer: Array.from(farmer.secretKey), investor: Array.from(investor.secretKey) }), { mode: 0o600 });
  return { farmer, investor };
}

/**
 * The complete lifecycle on devnet: fresh farmer and investor keypairs, the real role keys and sponsor. Workflow data
 * goes to DEMO_DATABASE_URL (a local, non-production Postgres) or an in-process database; never to production.
 * Regulator CSVs go to DEMO_EXPORT_DIR (default: the current directory).
 */
export async function runLifecycleFlowFromEnv(source: Record<string, string | undefined> = process.env, log: (line: string) => void = console.log) {
  const url = source.DEMO_DATABASE_URL?.trim();
  const db = url ? await createPgDb(url) : await ephemeralDb();
  if (await isProductionDb(db)) throw new Error("DEMO_DATABASE_URL points at the production database; the walk never writes demo accounts there.");
  log(url ? "Workflow data: DEMO_DATABASE_URL" : "Workflow data: in-process database (discarded at exit)");
  const ctx = await createDemoContext(source);
  const { farmer, investor } = await walkKeys(source.DEMO_KEYS_FILE);
  const chain = makeArrangerChain({ program: ctx.program, ops: () => ctx.ops, stub: () => ctx.stub, store: () => ctx.store, publicBaseUrl: ctx.env.PUBLIC_BASE_URL, getPool: (id) => ctx.reader.getPool(id) });
  const pool = async (id: string) => {
    const d = await ctx.reader.getPool(id);
    if (!d) throw new Error(`pool ${id} not found`);
    return d;
  };
  const holder = async (id: string, amount: bigint) => {
    const d = await pool(id);
    return { investor: investor.publicKey, pool: new PublicKey(d.pool.address), mint: new PublicKey(d.pool.mint), vault: new PublicKey(d.pool.vault), usdcMint: ctx.usdcMint, amount };
  };
  const mint = (to: PublicKey, amount: bigint) =>
    ctx.send([ctx.keys.deployer], [createUsdcAtaIx(ctx.keys.deployer.publicKey, to, ctx.usdcMint), mintUsdcIx(ctx.usdcMint, usdcAta(ctx.usdcMint, to), ctx.keys.deployer.publicKey, amount)]);
  const exportDir = source.DEMO_EXPORT_DIR ?? ".";
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  log(`Farmer ${farmer.publicKey.toBase58()}, investor ${investor.publicKey.toBase58()}`);
  return runLifecycleFlow(
    {
      db,
      chain,
      storeDocument: (bytes) => storeDocument(ctx.store, bytes, "application/pdf"),
      storeFieldSet: async (fields) => (await storeFieldSet(ctx.store, fields)).hash,
      fund: async (f, i, investorUsd) => {
        await mint(new PublicKey(f), 20_000_000n);
        return mint(new PublicKey(i), BigInt(investorUsd) * 1_000_000n);
      },
      mintToFarmer: (amount) => mint(farmer.publicKey, amount),
      registerFields: (app) => registerDemoFields(ctx, farmer, app),
      networkFee: ctx.fees.networkFee,
      subscribe: async (id, amount) => ctx.sponsored("subscribe", investor, [await subscribeIx(ctx.program, { ...(await holder(id, amount)), payer: ctx.keys.sponsor.publicKey, treasury: ctx.treasury })]),
      closeSubscription: (id) => closeSubscription(ctx.ops, BigInt(id)),
      disburse: (id) => disburseAll(ctx.ops, BigInt(id)),
      elect: async (id, election) => ctx.sponsored("elect-settlement", farmer, [await electSettlementIx(ctx.program, { signer: farmer.publicKey, pool: new PublicKey((await pool(id)).pool.address), election })]),
      fundBuyback: async (id, amount) => {
        const d = await pool(id);
        return ctx.sponsored("fund-redemption", farmer, [await fundRedemptionIx(ctx.program, { issuer: farmer.publicKey, pool: new PublicKey(d.pool.address), usdcMint: ctx.usdcMint, vault: new PublicKey(d.pool.vault), amount })]);
      },
      vaultBalance: async (id) => ctx.ops.tokenBalance(new PublicKey((await pool(id)).pool.vault)),
      recordSettlement: async (id) => {
        const d = await pool(id);
        const buyback = d.terms ? effectiveElection(d.terms, Math.floor(Date.now() / 1000), d.pool.maturityTs) === "Buyback" : false;
        const sigs: string[] = [];
        for (const p of d.projects.filter((x) => x.settlement === null)) sigs.push(await recordSettlement(ctx.ops, BigInt(id), new PublicKey(p.address), buyback || !p.harvestAttested ? "CashRepaidWithPremium" : "Delivered"));
        return sigs;
      },
      openRedemption: async (id) => (await fundRedemption(ctx.ops, BigInt(id))).signatures,
      redeem: async (id, amount) => ctx.sponsored("redeem", investor, [createUsdcAtaIx(ctx.keys.sponsor.publicKey, investor.publicKey, ctx.usdcMint), await redeemIx(ctx.program, await holder(id, amount))]),
      redeemDelivery: async (id, amount) => {
        const h = await holder(id, amount);
        return ctx.sponsored("redeem-delivery", investor, [await redeemDeliveryIx(ctx.program, { investor: h.investor, pool: h.pool, mint: h.mint, amount })]);
      },
      sweep: (id) => sweep(ctx.ops, BigInt(id)),
      // A read-only snapshot for the regulator: retried through public RPC rate limits, never fatal to the walk.
      holders: async (m) => {
        for (let i = 0; i < 5; i++) {
          try {
            return await ctx.reader.holders(m);
          } catch {
            await sleep(10_000);
          }
        }
        log(`         holders of ${m} could not be read (RPC rate limit); the snapshot skips them`);
        return [];
      },
      // The program reads the cluster clock; give it a margin past the wall clock.
      waitUntil: async (ts) => {
        while (Date.now() / 1000 < ts + 20) await sleep(5_000);
      },
      writeExport: async (name, csv) => {
        await mkdir(exportDir, { recursive: true });
        await writeFile(join(exportDir, name), csv);
        log(`         wrote ${join(exportDir, name)}`);
      },
      wallets: { farmer: farmer.publicKey.toBase58(), investor: investor.publicKey.toBase58() },
      tx: ctx.tx,
      now: () => Math.floor(Date.now() / 1000),
      maturityMinutes: Number(source.DEMO_MATURITY_MINUTES ?? 14),
      breathe: () => sleep(3_000),
    },
    log,
    stamp,
  );
}
