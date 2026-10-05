import { projectPda } from "@f2f/sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import { closeSubscription, disburseAll } from "../chain/admin-ops";
import { makeArrangerChain } from "../chain/arranger-chain";
import { createUsdcAtaIx, mintUsdcIx, registerFieldIx, registerProjectIx, subscribeIx, usdcAta } from "../chain/ix";
import { isProductionDb } from "../auth/session";
import { createPgDb, schema, type Db } from "../db/client";
import { storeDocument, storeFieldSet } from "../pilot-docs";
import { uploadPolygon } from "../polygons";
import { runCabinetFlow } from "./cabinet-flow";
import { createDemoContext } from "./context";
import { DEMO_FIELDS } from "./fields";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** An in-process Postgres (PGlite) with every committed migration: the walk's accounts live and die with the process. */
async function ephemeralDb(): Promise<Db> {
  const [{ PGlite }, { drizzle }, { migrate }, { fileURLToPath }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
    import("node:url"),
  ]);
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../../drizzle", import.meta.url)) });
  return db as unknown as Db;
}

/**
 * The cabinet walk on devnet: fresh farmer and investor keypairs, the real role keys and sponsor. The workflow data goes
 * to an in-process database (or DEMO_DATABASE_URL), never to the production Postgres: demo and dev identities must not
 * exist there, and the database refuses them once marked production.
 */
export async function runCabinetFlowFromEnv(source: Record<string, string | undefined> = process.env, log: (line: string) => void = console.log) {
  const url = source.DEMO_DATABASE_URL?.trim();
  const db = url ? await createPgDb(url) : await ephemeralDb();
  if (await isProductionDb(db)) throw new Error("DEMO_DATABASE_URL points at the production database; the walk never writes demo accounts there.");
  log(url ? "Workflow data: DEMO_DATABASE_URL" : "Workflow data: in-process database (discarded at exit)");
  const ctx = await createDemoContext(source);
  const farmer = Keypair.generate();
  const investor = Keypair.generate();
  const chain = makeArrangerChain({
    program: ctx.program,
    ops: () => ctx.ops,
    stub: () => ctx.stub,
    store: () => ctx.store,
    publicBaseUrl: ctx.env.PUBLIC_BASE_URL,
    getPool: (id) => ctx.reader.getPool(id),
  });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return runCabinetFlow(
    {
      db,
      chain,
      storeDocument: (bytes) => storeDocument(ctx.store, bytes, "application/pdf"),
      storeFieldSet: async (fields) => (await storeFieldSet(ctx.store, fields)).hash,
      fund: (f, i, investorUsd) =>
        ctx.send([ctx.keys.deployer], [
          createUsdcAtaIx(ctx.keys.deployer.publicKey, new PublicKey(f), ctx.usdcMint),
          mintUsdcIx(ctx.usdcMint, usdcAta(ctx.usdcMint, new PublicKey(f)), ctx.keys.deployer.publicKey, 10_000_000n),
          createUsdcAtaIx(ctx.keys.deployer.publicKey, new PublicKey(i), ctx.usdcMint),
          mintUsdcIx(ctx.usdcMint, usdcAta(ctx.usdcMint, new PublicKey(i)), ctx.keys.deployer.publicKey, BigInt(investorUsd) * 1_000_000n),
        ]),
      registerFields: async (app) => {
        const uploads = [];
        for (const f of DEMO_FIELDS) uploads.push({ name: f.name, ...(await uploadPolygon(ctx.store, f.geojson)) });
        const projectId = BigInt(Date.now());
        const project = projectPda(ctx.programId, farmer.publicKey, projectId);
        const signature = await ctx.sponsored("register-project", farmer, [
          await registerProjectIx(ctx.program, {
            producer: farmer.publicKey,
            payer: ctx.keys.sponsor.publicKey,
            projectId,
            crop: app.crop,
            season: app.season,
            expectedKg: BigInt(app.volumeT) * 1000n,
            requestedAmount: BigInt(app.requestedUsd) * 1_000_000n,
            fees: { usdcMint: ctx.usdcMint, treasury: ctx.treasury },
          }),
          ...(await Promise.all(
            uploads.map((u, index) => registerFieldIx(ctx.program, { producer: farmer.publicKey, payer: ctx.keys.sponsor.publicKey, project, index, polygonHash: u.polygonHash, areaHaX100: u.areaHaX100 })),
          )),
        ]);
        // Fake cadastral numbers: the field set lives in the bucket only.
        const fields = uploads.map((u, i) => ({ polygonHash: u.polygonHash, areaHaX100: u.areaHaX100, name: u.name, cadastralNumber: `00-000-000-00${i}`, declaredAreaHa: u.areaHaX100 / 100 }));
        return { project: project.toBase58(), signature, fields };
      },
      networkFee: ctx.fees.networkFee,
      subscribe: async (poolId, amount) => {
        const d = await ctx.reader.getPool(poolId);
        if (!d) throw new Error(`pool ${poolId} not found`);
        return ctx.sponsored("subscribe", investor, [
          await subscribeIx(ctx.program, {
            investor: investor.publicKey,
            pool: new PublicKey(d.pool.address),
            mint: new PublicKey(d.pool.mint),
            vault: new PublicKey(d.pool.vault),
            usdcMint: ctx.usdcMint,
            amount,
            payer: ctx.keys.sponsor.publicKey,
            treasury: ctx.treasury,
          }),
        ]);
      },
      closeSubscription: (poolId) => closeSubscription(ctx.ops, BigInt(poolId)),
      disburse: (poolId) => disburseAll(ctx.ops, BigInt(poolId)),
      wallets: { farmer: farmer.publicKey.toBase58(), investor: investor.publicKey.toBase58() },
      tx: ctx.tx,
      now: () => Math.floor(Date.now() / 1000),
      breathe: () => sleep(4_000),
    },
    log,
    stamp,
  );
}
