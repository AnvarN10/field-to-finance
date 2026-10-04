import { PILOT_QUALITY_SPEC, poolPda, projectPda, redemptionDue } from "@f2f/sdk";
import { Keypair } from "@solana/web3.js";
import {
  addProject,
  adminMintUsdc,
  approveInvestor,
  closeSubscription,
  createPool,
  createPoolInput,
  disburseAll,
  nextPoolId,
  openPool,
  recordDelivery,
  recordSettlement,
} from "../chain/admin-ops";
import { explainChainError } from "../chain/explain";
import { createUsdcAtaIx, electSettlementIx, fundRedemptionIx, mintUsdcIx, redeemDeliveryIx, redeemIx, registerFieldIx, registerProjectIx, subscribeIx, usdcAta } from "../chain/ix";
import { sendSkippingPreflight } from "../chain/send";
import { explorerAddress, formatTonnes, formatUsd, formatUsdDown } from "../format";
import { FARMER_REQUIREMENTS, recordOnboardingDocument, storeDeliveryEvidence, storeDocument, storeQualitySpec } from "../pilot-docs";
import { uploadPolygon } from "../polygons";
import { attestStage, attestStub } from "../scas-stub";
import { createDemoContext } from "./context";
import { sceneLine } from "./main-flow";

/**
 * The pilot term sheet on devnet (ADR 0014): the farmer is the issuer of record, ten $100,000 tokens,
 * 5% a year Act/360, hybrid settlement. `demo` runs one settlement path end to end in minutes; `seed`
 * leaves a standing pilot pool open for subscription. Field boundaries are labelled samples until the
 * farm's own export arrives; no pilot identifiers are used.
 */
export const PILOT_ISSUE_USD = 1_000_000;
export const PILOT_TOKEN_USD = 100_000;
const USDC = 1_000_000n;
const ISSUE = BigInt(PILOT_ISSUE_USD) * USDC;
const TOKEN = BigInt(PILOT_TOKEN_USD) * USDC;
const MINT_FEE_BUFFER = 10n * USDC;

export type PilotMode = "demo" | "seed";
export type PilotPath = "buyback" | "delivery";

export const pilotSchedule = (mode: PilotMode) =>
  mode === "demo" ? { closeInMinutes: 4, maturityInMinutes: 7 } : { closeInMinutes: 21 * 24 * 60, maturityInMinutes: 360 * 24 * 60 };

export function pilotPoolInput(poolId: string, issuerOfRecord: string, mode: PilotMode) {
  return {
    poolId,
    crop: "wheat",
    season: 2027,
    name: mode === "seed" ? "Wheat 2027 pilot, sample fields" : "Wheat 2027 pilot demo",
    symbol: "WHEAT-2027",
    // Informational on term-sheet pools: payouts use the coupon in InstrumentTerms.
    yieldBps: 500,
    premiumBps: 550,
    arrangementFeeBps: 0,
    ...pilotSchedule(mode),
    instrument: {
      issuerOfRecord,
      unitNominalUsd: PILOT_TOKEN_USD,
      couponBps: 500,
      settlementMode: "Hybrid" as const,
      volumeTonnes: 10_000,
      tokenizedShareBps: 3_000,
      elevator: "Ust-Kamenogorsk",
      lab: "Baltic Control",
      // Demo only: 300 days of coupon accrue although the pool matures in minutes.
      ...(mode === "demo" ? { interestDays: 300 } : {}),
    },
  };
}

const ring = (lon: number, lat: number, w: number, h: number) => [
  [lon, lat],
  [lon + w, lat],
  [lon + w, lat + h],
  [lon, lat + h],
  [lon, lat],
];

/** Sample boundaries on farmland north-west of Ust-Kamenogorsk. Placeholders, not the pilot farm's fields. */
export const PILOT_SAMPLE_FIELDS: { name: string; geojson: object }[] = [
  { name: "Sample field 1", geojson: { type: "Feature", properties: { name: "Sample field 1 (placeholder)" }, geometry: { type: "Polygon", coordinates: [ring(82.21, 50.1, 0.03, 0.02)] } } },
  { name: "Sample field 2", geojson: { type: "Feature", properties: { name: "Sample field 2 (placeholder)" }, geometry: { type: "Polygon", coordinates: [ring(82.25, 50.1, 0.03, 0.02)] } } },
];

const SAMPLE_DOC = (what: string) => new TextEncoder().encode(`%PDF-1.4\n% Sample document for the devnet demo: ${what}. Not a real document.\n`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runPilotFromEnv(
  opts: { mode: PilotMode; path?: PilotPath; farmer?: Keypair },
  source: Record<string, string | undefined> = process.env,
  log: (line: string) => void = console.log,
) {
  const c = await createDemoContext(source);
  const { tx, program, programId, usdcMint, keys, ops, send, sponsored, stub, store, treasury, connection, cluster } = c;
  let n = 0;
  const scene = (title: string, url?: string) => log(sceneLine(++n, title, url));
  const base = c.env.PUBLIC_BASE_URL;

  // 1. The farmer, issuer of record, passes full KYC and provides the term sheet's documents.
  const farmer = opts.farmer ?? Keypair.generate();
  const investor = Keypair.generate();
  const fundFarmer = await send([keys.deployer], [
    createUsdcAtaIx(keys.deployer.publicKey, farmer.publicKey, usdcMint),
    mintUsdcIx(usdcMint, usdcAta(usdcMint, farmer.publicKey), keys.deployer.publicKey, MINT_FEE_BUFFER),
  ]);
  scene(`Farmer ${farmer.publicKey.toBase58()} (issuer of record) gets test USDC for the mint fee and no SOL`, tx(fundFarmer));
  if (opts.mode === "demo") {
    for (const r of FARMER_REQUIREMENTS) {
      await recordOnboardingDocument(store, farmer.publicKey.toBase58(), r.key, SAMPLE_DOC(r.label), "application/pdf", Math.floor(Date.now() / 1000));
    }
    scene(`Arranger stores the farmer's ${FARMER_REQUIREMENTS.length} onboarding documents in the bucket by hash (sample PDFs in this demo)`);
  }
  // The standing pilot pool leaves the checklist pending until the farmer's real documents are uploaded.
  scene("Compliance approves the farmer: full KYC of the issuer", tx(await approveInvestor(ops, farmer.publicKey)));

  // 2. Fields and verification.
  const uploads = [];
  for (const f of PILOT_SAMPLE_FIELDS) uploads.push(await uploadPolygon(store, f.geojson));
  const projectId = BigInt(Date.now());
  const project = projectPda(programId, farmer.publicKey, projectId);
  const reg = await sponsored("register-project", farmer, [
    await registerProjectIx(program, {
      producer: farmer.publicKey,
      payer: keys.sponsor.publicKey,
      projectId,
      crop: "wheat",
      season: 2027,
      expectedKg: 10_000_000n,
      requestedAmount: ISSUE,
      fees: { usdcMint, treasury },
    }),
    ...(await Promise.all(
      uploads.map((u, index) => registerFieldIx(program, { producer: farmer.publicKey, payer: keys.sponsor.publicKey, project, index, polygonHash: u.polygonHash, areaHaX100: u.areaHaX100 })),
    )),
  ]);
  scene(`Farmer registers 10,000 t of wheat asking ${formatUsd(ISSUE)}, with ${uploads.length} sample fields (placeholders until the farm's export arrives)`, tx(reg));
  for (let i = 0; i < uploads.length; i++) {
    const r = await attestStub(stub, { project, fieldIndex: i, kind: "FieldVerified" });
    scene(`SCAS stub verifies sample field ${i + 1}`, tx(r.signature));
  }

  // 3. The arranger creates WHEAT-2027 with the term sheet's terms in the same transaction.
  const poolId = nextPoolId((await program.account.pool.all()).map((p) => p.account.poolId.toString()));
  const spec = await storeQualitySpec(store, PILOT_QUALITY_SPEC, base);
  const created = await createPool(ops, createPoolInput.parse(pilotPoolInput(poolId, farmer.publicKey.toBase58(), opts.mode)), base, spec);
  scene(`Arranger creates pool ${poolId}: issuer of record = the farmer, 10 tokens of ${formatUsd(TOKEN)}, coupon 5% a year Act/360, hybrid settlement, quality spec ${spec.hash.slice(0, 8)}…`, tx(created.signature));
  scene("Arranger adds the farmer's project", tx(await addProject(ops, BigInt(poolId), project)));
  scene("Arranger opens the pool", tx(await openPool(ops, BigInt(poolId))));
  const poolKey = poolPda(programId, BigInt(poolId));
  if (opts.mode === "seed") {
    scene(`Pilot pool ${poolId} is open for subscription`, explorerAddress(poolKey.toBase58(), cluster));
    return { poolId, scenes: n, farmer: farmer.publicKey.toBase58() };
  }

  // 4. A demo investor buys all ten tokens with no SOL.
  const pool = await program.account.pool.fetch(poolKey);
  const holder = (amount: bigint) => ({ investor: investor.publicKey, pool: poolKey, mint: pool.mint, vault: pool.vault, usdcMint, amount });
  scene(`Admin mints the demo investor ${formatUsd(ISSUE + USDC)} of test USDC`, tx(await adminMintUsdc(ops, investor.publicKey, PILOT_ISSUE_USD + 1)));
  scene("Compliance approves the investor", tx(await approveInvestor(ops, investor.publicKey)));
  const half = await sendSkippingPreflight(connection, [keys.sponsor, investor], [await subscribeIx(program, { ...holder(TOKEN / 2n), payer: keys.sponsor.publicKey, treasury })]);
  scene(`Investor tries half a token (${formatUsd(TOKEN / 2n)}): ${explainChainError({ logs: half.logs, error: half.err }).title}`, tx(half.signature));
  const sub = await sponsored("subscribe", investor, [await subscribeIx(program, { ...holder(ISSUE), payer: keys.sponsor.publicKey, treasury })]);
  scene(`Investor buys 10 tokens for ${formatUsd(ISSUE)} plus the network fee, no SOL`, tx(sub));
  scene("The pool is full; subscription closes as Funded", tx(await closeSubscription(ops, BigInt(poolId))));
  for (const s of await disburseAll(ops, BigInt(poolId))) scene(`Arranger disburses ${formatUsd(ISSUE)} to the farmer`, tx(s));

  const maturity = pool.maturityTs.toNumber();
  const waitForMaturity = async () => {
    while (Math.floor(Date.now() / 1000) < maturity) {
      log(`         waiting for maturity (${maturity - Math.floor(Date.now() / 1000)} s)`);
      await sleep(15_000);
    }
  };

  if ((opts.path ?? "buyback") === "buyback") {
    // 5a. The farmer exercises the buyback right and funds principal plus coupon.
    scene("Farmer elects buyback (the issuer's right under the hybrid terms)", tx(await send([keys.sponsor, farmer], [await electSettlementIx(program, { signer: farmer.publicKey, pool: poolKey, election: "Buyback" })])));
    const detail = await c.reader.getPool(poolId);
    const harvest = await attestStage(stub, detail?.projects ?? [], "Harvest");
    if (harvest.failures.length) throw new Error(`Harvest: ${harvest.failures[0]?.error}`);
    scene("SCAS stub attests the harvest", tx(harvest.results[0]!.signature));
    scene("Arranger records settlement: repaid in cash", tx(await recordSettlement(ops, BigInt(poolId), project, "CashRepaidWithPremium")));
    await waitForMaturity();
    const t = await ops.loadTerms(poolKey);
    if (!t) throw new Error("InstrumentTerms missing");
    const due = redemptionDue(ISSUE, { yieldBps: pool.yieldBps, maturityTs: maturity }, { couponBpsAnnual: t.couponBpsAnnual, startTs: t.startTs.toNumber() });
    const farmerUsdc = usdcAta(usdcMint, farmer.publicKey);
    const have = await ops.tokenBalance(farmerUsdc);
    if (have < due) {
      // Stands in for the farmer's harvest sale proceeds.
      await send([keys.deployer], [mintUsdcIx(usdcMint, farmerUsdc, keys.deployer.publicKey, due - have)]);
    }
    const funded = await send([keys.sponsor, farmer], [await fundRedemptionIx(program, { issuer: farmer.publicKey, pool: poolKey, usdcMint, vault: pool.vault, amount: due })]);
    scene(`Farmer funds the buyback: ${formatUsdDown(due)} = $1,000,000 × (1 + 5% × 300/360); the pool opens for redemption`, tx(funded));
    const before = await ops.tokenBalance(usdcAta(usdcMint, investor.publicKey));
    const redeemed = await sponsored("redeem", investor, [createUsdcAtaIx(keys.sponsor.publicKey, investor.publicKey, usdcMint), await redeemIx(program, holder(ISSUE))]);
    const got = (await ops.tokenBalance(usdcAta(usdcMint, investor.publicKey))) - before;
    scene(`Investor redeems 10 tokens for ${formatUsdDown(got)}`, tx(redeemed));
  } else {
    // 5b. Delivery: the grain goes to the elevator, the lab certifies it, holders claim grain.
    scene("Farmer elects grain delivery", tx(await send([keys.sponsor, farmer], [await electSettlementIx(program, { signer: farmer.publicKey, pool: poolKey, election: "Delivery" })])));
    for (const [kind, label] of [["ElevatorReceipt", "elevator receipt for 3,000 t"], ["LabQuality", "lab certificate, HiPro class 3"]] as const) {
      const doc = await storeDocument(store, SAMPLE_DOC(label), "application/pdf");
      const evidence = await storeDeliveryEvidence(store, { kind, verdict: "Pass", poolId, documentSha256: doc.sha256, ...(kind === "ElevatorReceipt" ? { kg: "3000000" } : {}) }, base, Math.floor(Date.now() / 1000));
      const sig = await recordDelivery(ops, BigInt(poolId), { kind, verdict: "Pass", evidenceHash: evidence.hash, evidenceUri: evidence.uri });
      scene(`Arranger records the ${label} (sample document) as a ${kind} attestation`, tx(sig));
    }
    await waitForMaturity();
    const refused = await sendSkippingPreflight(connection, [keys.sponsor, farmer], [await fundRedemptionIx(program, { issuer: farmer.publicKey, pool: poolKey, usdcMint, vault: pool.vault, amount: 0n })]);
    scene(`Cash redemption stays closed: ${explainChainError({ logs: refused.logs, error: refused.err }).title}`, tx(refused.signature));
    const claimed = await sponsored("redeem-delivery", investor, [await redeemDeliveryIx(program, { investor: investor.publicKey, pool: poolKey, mint: pool.mint, amount: ISSUE })]);
    const terms = await ops.loadTerms(poolKey);
    scene(`Investor burns 10 tokens for a Grain Claim of ${formatTonnes(terms?.deliveredKg.toString() ?? "0")} at Ust-Kamenogorsk (GrainClaim event)`, tx(claimed));
  }
  scene(`Done. Pool ${poolId}`, explorerAddress(poolKey.toBase58(), cluster));
  return { poolId, scenes: n, farmer: farmer.publicKey.toBase58() };
}
