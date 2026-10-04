import { poolPda, projectPda, splitArrangementFee } from "@f2f/sdk";
import { TOKEN_2022_PROGRAM_ID, createTransferCheckedInstruction } from "@solana/spl-token";
import { Keypair, SystemProgram } from "@solana/web3.js";
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
} from "../chain/admin-ops";
import { explainChainError } from "../chain/explain";
import { createInstrumentAtaIx, createUsdcAtaIx, instrumentAta, mintUsdcIx, redeemIx, registerFieldIx, registerProjectIx, subscribeIx, usdcAta } from "../chain/ix";
import { sendSkippingPreflight } from "../chain/send";
import { explorerAddress, formatUsd, withYield } from "../format";
import { uploadPolygon } from "../polygons";
import { attestStage, attestStub } from "../scas-stub";
import { createDemoContext } from "./context";
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

const RPC_BREATHER_MS = 4_000;
const sleep =(ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runFromEnv(source: Record<string, string | undefined> = process.env, log: (line: string) => void = console.log) {
  const { env, cluster, tx, connection, programId, usdcMint, program, reader, store, keys, send, ops, fees, treasury, treasuryUsdc, sponsored, treasuryGain, stub } =
    await createDemoContext(source);
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
  // Public devnet RPC rate-limits bursts (getProgramAccounts especially); give it room between heavy reads.
  await sleep(RPC_BREATHER_MS);
  const detail = await reader.getPool(poolId);
  for (const kind of ["Sowing", "Vegetation", "Harvest"] as const) {
    await sleep(RPC_BREATHER_MS);
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
