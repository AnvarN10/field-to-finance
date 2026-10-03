import { poolPda, projectPda, splitArrangementFee } from "@f2f/sdk";
import { TOKEN_2022_PROGRAM_ID, createTransferCheckedInstruction } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";
import { cosignAndSend, type SponsorPolicy } from "../chain/sponsor";
import type { TxAction } from "../chain/user-tx";
import {
  addProject,
  approveInvestor,
  closeSubscription,
  createPool,
  createPoolInput,
  disburseAll,
  fundRedemption,
  nextPoolId,
  openPool,
  recordSettlement,
  sweep,
  type OpsContext,
} from "../chain/admin-ops";
import { explainChainError } from "../chain/explain";
import { projectsInPool } from "../chain/filters";
import { createInstrumentAtaIx, createUsdcAtaIx, instrumentAta, mintUsdcIx, redeemIx, registerFieldIx, registerProjectIx, subscribeIx, usdcAta } from "../chain/ix";
import { createProgram } from "../chain/program";
import { createChainReader } from "../chain/reader";
import { buildV0, bytesToBase64, confirmOrThrow, sendServerTx, sendSkippingPreflight } from "../chain/send";
import { parseServerEnv } from "../env";
import { explorerAddress, explorerTx, formatUsd, withYield } from "../format";
import { parseKeypair } from "../keys";
import { uploadPolygon } from "../polygons";
import { attestStage, attestStub, type StubDeps } from "../scas-stub";
import { S3Store } from "../store";
import { DEMO_FIELDS } from "./fields";

export const DEMO_TARGET = 2_000_000_000n; // $2,000.00
export const demoSchedule = () => ({ closeInMinutes: 4, maturityInMinutes: 6 });

export const sceneLine = (n: number, title: string, url?: string) => (url ? `Scene ${n}: ${title}\n         ${url}` : `Scene ${n}: ${title}`);

/** ADR 0013: fresh actors get no SOL at all; the gas sponsor pays every fee and the rent of their accounts. */
export const ACTOR_LAMPORTS = 0;
/** Test USDC for the producer: covers the 3 USDC mint fee at registration. */
export const DEMO_PRODUCER_USDC = 10_000_000n;
/** Demo arrangement fee: 2% withheld from the farmer at disbursement. */
export const DEMO_ARRANGEMENT_BPS = 200;
const ROLE_FLOOR = 200_000_000;
const ROLE_TARGET = 300_000_000;
/** Lamports the deployer sends a role key (Issuer, compliance, SCAS pay rent too): up to 0.3 SOL when below 0.2 SOL. */
export const roleTopUp = (balance: number) => (balance < ROLE_FLOOR ? ROLE_TARGET - balance : 0);

const sleep =(ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runFromEnv(source: Record<string, string | undefined> = process.env, log: (line: string) => void = console.log) {
  const env = parseServerEnv(source);
  const missingBucket = (["BUCKET_NAME", "BUCKET_ENDPOINT", "BUCKET_ACCESS_KEY_ID", "BUCKET_SECRET_ACCESS_KEY"] as const).filter((k) => !env[k]);
  if (missingBucket.length) throw new Error(`Set ${missingBucket.join(", ")} (Railway bucket credentials) before running the demo`);
  const cluster = env.SOLANA_CLUSTER;
  const tx = (sig: string) => explorerTx(sig, cluster);
  const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  const programId = new PublicKey(env.F2F_PROGRAM_ID);
  const usdcMint = new PublicKey(env.USDC_MINT);
  const program = createProgram(connection, programId);
  const reader = createChainReader({ program, connection, usdcMint, ttlMs: 0 });
  const store = new S3Store({
    bucket: env.BUCKET_NAME as string,
    endpoint: env.BUCKET_ENDPOINT as string,
    region: env.BUCKET_REGION,
    accessKeyId: env.BUCKET_ACCESS_KEY_ID as string,
    secretAccessKey: env.BUCKET_SECRET_ACCESS_KEY as string,
    forcePathStyle: env.BUCKET_FORCE_PATH_STYLE,
  });
  const keys = {
    deployer: parseKeypair("F2F_DEPLOYER_KEYPAIR", env.F2F_DEPLOYER_KEYPAIR),
    issuer: parseKeypair("F2F_ISSUER_KEYPAIR", env.F2F_ISSUER_KEYPAIR),
    compliance: parseKeypair("F2F_COMPLIANCE_KEYPAIR", env.F2F_COMPLIANCE_KEYPAIR),
    scas: parseKeypair("SCAS_SECRET_KEY", env.SCAS_SECRET_KEY),
    sponsor: parseKeypair("F2F_SPONSOR_KEYPAIR", env.F2F_SPONSOR_KEYPAIR),
  };
  const send = (signers: Keypair[], ixs: TransactionInstruction[]) => sendServerTx(connection, signers, ixs);
  const ops: OpsContext = {
    program,
    usdcMint,
    roles: { issuer: keys.issuer.publicKey, compliance: keys.compliance.publicKey, deployer: keys.deployer.publicKey },
    send: (role, ixs) => send([keys[role]], ixs),
    loadPool: async (id) => program.account.pool.fetch(poolPda(programId, id)),
    loadProjects: async (pool) => (await program.account.farmProject.all([projectsInPool(pool)])).map((r) => ({ address: r.publicKey, account: r.account })),
    tokenBalance: async (a) => {
      try {
        return BigInt((await connection.getTokenAccountBalance(a, "confirmed")).value.amount);
      } catch {
        return 0n;
      }
    },
    accountExists: async (a) => (await connection.getAccountInfo(a, "confirmed")) !== null,
    loadFees: () => reader.fees(),
    now: () => Math.floor(Date.now() / 1000),
  };
  const fees = await reader.fees();
  if (!fees) throw new Error("FeeConfig is not initialized; run scripts/devnet-init-fees.ts first");
  const treasury = new PublicKey(fees.treasury);
  const treasuryUsdc = usdcAta(usdcMint, treasury);
  const treasuryStart = await ops.tokenBalance(treasuryUsdc);
  const policy: SponsorPolicy = { program, sponsor: keys.sponsor.publicKey, usdcMint, treasury };
  /** The production path (ADR 0013): the user signs, the sponsor validates, co-signs as fee payer and submits. */
  const sponsored = async (action: TxAction, user: Keypair, ixs: TransactionInstruction[]) => {
    const { tx: unsigned, blockhash, lastValidBlockHeight } = await buildV0(connection, keys.sponsor.publicKey, ixs);
    unsigned.sign([user]);
    const signature = await cosignAndSend({ policy, sponsorKey: keys.sponsor, connection }, action, bytesToBase64(unsigned.serialize()));
    await confirmOrThrow(connection, signature, blockhash, lastValidBlockHeight);
    return signature;
  };
  const treasuryGain = async () => (await ops.tokenBalance(treasuryUsdc)) - treasuryStart;
  const stub: StubDeps = {
    program,
    readField: (a) => program.account.field.fetchNullable(a),
    send: (ixs) => send([keys.scas], ixs),
    store,
    scas: keys.scas.publicKey,
    publicBaseUrl: env.PUBLIC_BASE_URL,
    cluster,
  };

  let n = 0;
  const scene = (title: string, url?: string) => log(sceneLine(++n, title, url));

  // Fresh actors for every run, so the video never depends on old state.
  const producer = Keypair.generate();
  const alice = Keypair.generate(); // will pass KYC
  const bob = Keypair.generate(); // never passes KYC
  // Role keys pay rent too (compliance: InvestorRecord, SCAS: Attestations, Issuer: pool accounts).
  const roleTopUps = [];
  for (const k of [keys.issuer, keys.compliance, keys.scas, keys.sponsor]) {
    const lamports = roleTopUp(await connection.getBalance(k.publicKey, "confirmed"));
    if (lamports > 0) roleTopUps.push(SystemProgram.transfer({ fromPubkey: keys.deployer.publicKey, toPubkey: k.publicKey, lamports }));
  }
  const fund = await send([keys.deployer], [
    ...roleTopUps,
    ...[alice, bob].flatMap((k) => [createUsdcAtaIx(keys.deployer.publicKey, k.publicKey, usdcMint), mintUsdcIx(usdcMint, usdcAta(usdcMint, k.publicKey), keys.deployer.publicKey, 5_000_000_000n)]),
    createUsdcAtaIx(keys.deployer.publicKey, producer.publicKey, usdcMint),
    mintUsdcIx(usdcMint, usdcAta(usdcMint, producer.publicKey), keys.deployer.publicKey, DEMO_PRODUCER_USDC),
  ]);
  scene(
    `Fresh Producer ${producer.publicKey.toBase58()} and investors Alice and Bob get test USDC and no SOL; gas sponsor ${keys.sponsor.publicKey.toBase58()} pays every fee`,
    tx(fund),
  );

  // 1. Producer registers a Farm Project with two fields.
  const uploads = [];
  for (const f of DEMO_FIELDS) uploads.push(await uploadPolygon(store, f.geojson));
  const projectId = BigInt(Date.now());
  const project = projectPda(programId, producer.publicKey, projectId);
  const reg = await sponsored("register-project", producer, [
    await registerProjectIx(program, {
      producer: producer.publicKey,
      payer: keys.sponsor.publicKey,
      projectId,
      crop: "wheat",
      season: 2027,
      expectedKg: 400_000n,
      requestedAmount: DEMO_TARGET,
      fees: { usdcMint, treasury },
    }),
    ...(await Promise.all(
      uploads.map((u, index) =>
        registerFieldIx(program, { producer: producer.publicKey, payer: keys.sponsor.publicKey, project, index, polygonHash: u.polygonHash, areaHaX100: u.areaHaX100 }),
      ),
    )),
  ]);
  scene(
    `Producer registers a wheat project with two fields and prepays the ${formatUsd(BigInt(fees.mintFee))} mint fee in USDC; the sponsor pays gas and rent (treasury +${formatUsd(await treasuryGain())})`,
    tx(reg),
  );

  // 2. SCAS (stub) verifies both fields.
  for (let i = 0; i < uploads.length; i++) {
    const r = await attestStub(stub, { project, fieldIndex: i, kind: "FieldVerified" });
    scene(`SCAS stub attests field ${i + 1}: FieldVerified, Pass. Evidence ${r.evidenceUri}`, tx(r.signature));
  }

  // 3. Issuer creates WHEAT-2027, adds the project and opens the pool.
  const poolId = nextPoolId((await program.account.pool.all()).map((p) => p.account.poolId.toString()));
  const created = await createPool(
    ops,
    createPoolInput.parse({ poolId, crop: "wheat", season: 2027, name: "Wheat 2027", symbol: "WHEAT-2027", yieldBps: 800, premiumBps: 550, arrangementFeeBps: DEMO_ARRANGEMENT_BPS, ...demoSchedule() }),
    env.PUBLIC_BASE_URL,
  );
  scene(
    `Issuer creates pool ${poolId} (WHEAT-2027, fixed yield 8.0%, premium 5.5%) and sets a ${DEMO_ARRANGEMENT_BPS / 100}% arrangement fee while Draft; maturity in ${demoSchedule().maturityInMinutes} minutes`,
    tx(created.signature),
  );
  scene("Issuer adds the verified project", tx(await addProject(ops, BigInt(poolId), project)));
  scene("Issuer opens the pool for subscription", tx(await openPool(ops, BigInt(poolId))));
  const pool = await program.account.pool.fetch(poolPda(programId, BigInt(poolId)));
  const poolKey = poolPda(programId, BigInt(poolId));
  const holder = (k: Keypair, amount: bigint) => ({ investor: k.publicKey, pool: poolKey, mint: pool.mint, vault: pool.vault, usdcMint, amount });
  const subscription = (k: Keypair, amount: bigint) => ({ ...holder(k, amount), payer: keys.sponsor.publicKey, treasury });

  // 4. Bob has no KYC: the program rejects his subscription on-chain (no InvestorRecord).
  const rejected = await sendSkippingPreflight(connection, [keys.sponsor, bob], [await subscribeIx(program, subscription(bob, 100_000_000n))]);
  scene(`Bob (no KYC) tries to subscribe $100.00 and fails: ${explainChainError({ logs: rejected.logs, error: rejected.err }).title}`, tx(rejected.signature));

  // Compliance approves Alice once for every pool; her account is created and thawed when she subscribes.
  scene("Compliance approves Alice (platform-level KYC, valid for every pool)", tx(await approveInvestor(ops, alice.publicKey)));
  const subscribed = await sponsored("subscribe", alice, [await subscribeIx(program, subscription(alice, DEMO_TARGET))]);
  scene(
    `Alice subscribes ${formatUsd(DEMO_TARGET)} plus the ${formatUsd(BigInt(fees.networkFee))} network fee with no SOL: her WHEAT-2027 account is created (sponsor pays rent) and thawed, USDC in, WHEAT-2027 out, one transaction (treasury +${formatUsd(await treasuryGain())} so far)`,
    tx(subscribed),
  );

  // The token itself enforces compliance: Bob can open a WHEAT-2027 account, but it starts frozen,
  // so Alice cannot send him the Instrument.
  await send([keys.sponsor], [createInstrumentAtaIx(keys.sponsor.publicKey, bob.publicKey, pool.mint)]);
  const frozen = await sendSkippingPreflight(connection, [keys.sponsor, alice], [
    createTransferCheckedInstruction(instrumentAta(pool.mint, alice.publicKey), pool.mint, instrumentAta(pool.mint, bob.publicKey), alice.publicKey, 1_000_000n, 6, [], TOKEN_2022_PROGRAM_ID),
  ]);
  scene(`Alice tries to send $1.00 of WHEAT-2027 to Bob: ${explainChainError({ logs: frozen.logs, error: frozen.err }).title}`, tx(frozen.signature));

  // 5. Pool is funded; Issuer disburses to the Producer.
  scene("Pool reaches its target; subscription closes as Funded", tx(await closeSubscription(ops, BigInt(poolId))));
  const split = splitArrangementFee(DEMO_TARGET, DEMO_ARRANGEMENT_BPS);
  for (const s of await disburseAll(ops, BigInt(poolId))) {
    scene(
      `Issuer disburses ${formatUsd(DEMO_TARGET)}: ${formatUsd(split.fee)} arrangement fee withheld for the treasury, the Producer receives ${formatUsd(split.net)}`,
      tx(s),
    );
  }

  // 6. SCAS (stub) attests the season.
  const detail = await reader.getPool(poolId);
  for (const kind of ["Sowing", "Vegetation", "Harvest"] as const) {
    const r = await attestStage(stub, detail?.projects ?? [], kind);
    if (r.failures.length) throw new Error(`${kind}: ${r.failures[0]?.error}`);
    scene(`SCAS stub attests ${kind} for ${r.results.length} fields`, tx(r.results[0]!.signature));
  }

  // 7. Settlement, redemption funding, investor redemption.
  scene("Issuer records settlement: volume shortfall covered from other fields", tx(await recordSettlement(ops, BigInt(poolId), project, "CoveredFromOtherFields")));
  let funded = await fundRedemption(ops, BigInt(poolId));
  scene(`Issuer deposits principal plus yield: ${formatUsd(funded.deposited)}`, tx(funded.signatures.at(-1)!));
  while (Math.floor(Date.now() / 1000) < pool.maturityTs.toNumber()) {
    log(`         waiting for maturity (${pool.maturityTs.toNumber() - Math.floor(Date.now() / 1000)} s)`);
    await sleep(15_000);
  }
  if (!funded.maturityPassed) {
    funded = await fundRedemption(ops, BigInt(poolId));
    scene("Maturity passed; the redemption check opens the pool for redemption", tx(funded.signatures.at(-1)!));
  }
  const before = await ops.tokenBalance(usdcAta(usdcMint, alice.publicKey));
  const redeemed = await sponsored("redeem", alice, [createUsdcAtaIx(keys.sponsor.publicKey, alice.publicKey, usdcMint), await redeemIx(program, holder(alice, DEMO_TARGET))]);
  const after = await ops.tokenBalance(usdcAta(usdcMint, alice.publicKey));
  scene(`Alice redeems ${formatUsd(DEMO_TARGET)} of WHEAT-2027 for ${formatUsd(after - before)} (expected ${formatUsd(withYield(DEMO_TARGET, 800))})`, tx(redeemed));
  scene("Issuer sweeps the empty vault", tx(await sweep(ops, BigInt(poolId))));
  const sol = await Promise.all([producer, alice, bob].map((k) => connection.getBalance(k.publicKey, "confirmed")));
  scene(
    `Fees: treasury received ${formatUsd(await treasuryGain())} (mint ${formatUsd(BigInt(fees.mintFee))} + network ${formatUsd(BigInt(fees.networkFee))} + arrangement ${formatUsd(split.fee)}). Producer, Alice and Bob hold ${sol.join("/")} lamports of SOL`,
    explorerAddress(treasuryUsdc.toBase58(), cluster),
  );
  scene(`Done. Pool ${poolId} is Redeeming with zero supply`, explorerAddress(poolKey.toBase58(), cluster));
  return { poolId, scenes: n };
}
