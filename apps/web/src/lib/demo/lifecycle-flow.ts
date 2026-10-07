import { PILOT_QUALITY_SPEC, redemptionDue } from "@f2f/sdk";
import { createPrivyPort } from "../auth/privy-port";
import { signInWithToken, type SessionUser } from "../auth/session";
import type { PoolDetail } from "../chain/views";
import { toCsv } from "../csv";
import type { Db } from "../db/client";
import type { ApplicationRow } from "../db/schema";
import { buildKfd, kfdHash } from "../kfd";
import type { FieldSetEntry } from "../pilot-docs";
import { termDefaults } from "../term-defaults";
import {
  advanceApplication,
  applicationDetail,
  decideFarmerKyc,
  decideInvestorKyc,
  publishApplication,
  refreshChainStatuses,
  reviewDocument,
  structureApplication,
  verifyApplicationFields,
} from "../workflow/arranger";
import { audit } from "../workflow/audit";
import { recordElevatorReceipt, recordLabProtocol } from "../workflow/delivery";
import { REQUIRED_KINDS } from "../workflow/documents";
import { addApplicationDocument, attachProject, createApplication, farmerProfile, saveFarmerProfile, submitApplication, submitFarmerKyc } from "../workflow/farmer";
import { acceptKfd, acknowledgeRisk, linkWallet, saveQuestionnaire, submitInvestorKyc } from "../workflow/investor";
import type { ArrangerChain, StoredDocInput } from "../workflow/ports";
import { eventRows, holderRows, registryRows } from "../workflow/regulator";
import { recordSeasonAttestation } from "../workflow/scas";
import { recordUserTransaction } from "../workflow/tx-history";
import { openAccount } from "../workflow/accounts";
import { acceptInvitation, createInvitation } from "../workflow/team";

/** The outside world of the walk: the devnet script wires real keys and the bucket, the test wires an in-memory chain. */
export interface LifecycleFlowDeps {
  db: Db;
  chain: ArrangerChain;
  storeDocument(bytes: Uint8Array): Promise<StoredDocInput>;
  storeFieldSet(fields: FieldSetEntry[]): Promise<string>;
  /** Test USDC: the farmer's mint fees and the investor's subscriptions. */
  fund(farmer: string, investor: string, investorUsd: number): Promise<string>;
  /** Test USDC for the farmer's buyback (principal plus coupon is more than the proceeds). */
  mintToFarmer(baseUnits: bigint): Promise<string>;
  registerFields(app: ApplicationRow): Promise<{ project: string; signature: string; fields: FieldSetEntry[] }>;
  networkFee: string | null;
  subscribe(poolId: string, amount: bigint): Promise<string>;
  closeSubscription(poolId: string): Promise<string>;
  disburse(poolId: string): Promise<string[]>;
  /** Signed by the farmer's wallet, sponsored. */
  elect(poolId: string, election: "Buyback" | "Delivery"): Promise<string>;
  fundBuyback(poolId: string, amount: bigint): Promise<string>;
  vaultBalance(poolId: string): Promise<bigint>;
  recordSettlement(poolId: string): Promise<string[]>;
  openRedemption(poolId: string): Promise<string[]>;
  /** Signed by the investor's wallet, sponsored. */
  redeem(poolId: string, amount: bigint): Promise<string>;
  redeemDelivery(poolId: string, amount: bigint): Promise<string>;
  sweep(poolId: string): Promise<string>;
  holders(mint: string): Promise<{ wallet: string; balance: string }[]>;
  waitUntil(unixSec: number): Promise<void>;
  writeExport(name: string, csv: string): Promise<void>;
  wallets: { farmer: string; investor: string };
  tx(signature: string): string;
  now(): number;
  maturityMinutes: number;
  breathe?(): Promise<void>;
}

const REQUESTED_USD = 2_000;
const pdf = (title: string) => new TextEncoder().encode(`%PDF-1.4\n% Field-to-Finance demo document, fake data only: ${title} ${Math.random()}\n%%EOF\n`);
const GOOD_LAB = { crop: "Wheat", class: "HiPro (class 3)", gluten: "31", protein: "15.2", moisture: "13.5", falling_number: "250", test_weight: "760", impurities: "1.5", odour: "None", gluten_deformation_index: "70", vitreousness: "55", pests: "None" };

/**
 * The whole platform on devnet through the workflow code the cabinets call: arranger grants the service roles; a farmer
 * applies twice; compliance decides KYC; the SCAS partner verifies fields and attests the season; the arranger
 * structures, publishes, closes and disburses; an investor subscribes; the elevator and the laboratory record delivery
 * documents; pool A takes the buyback path (farmer elects and funds, arranger settles, investor redeems, arranger
 * sweeps) and pool B the delivery path (farmer elects delivery, investor claims grain); the regulator exports the
 * registry, holders and events. Fake identities only (example.com, BIN and IIN 000000000000).
 */
export async function runLifecycleFlow(d: LifecycleFlowDeps, log: (line: string) => void, stamp: string) {
  let n = 0;
  const step = (title: string, sigs: (string | null | undefined)[] = []) => {
    log(`Step ${++n}: ${title}`);
    for (const s of sigs) if (s) log(`         ${d.tx(s)}`);
  };
  const breathe = d.breathe ?? (async () => {});
  const { db, chain } = d;
  const privy = createPrivyPort({ appId: undefined, appSecret: undefined, devAuth: true, nodeEnv: "development" });
  const signIn = async (email: string, arrangers: string[] = []): Promise<SessionUser> => (await signInWithToken(db, privy, `dev:${email}`, arrangers)).user;
  const email = (who: string) => `demo+${who}-${stamp}@example.com`;

  const arranger = await signIn(email("arranger"), [email("arranger")]);
  const service: Record<"compliance" | "scas" | "elevator" | "lab" | "regulator", SessionUser> = {} as never;
  for (const role of ["compliance", "scas", "elevator", "lab", "regulator"] as const) {
    const invitation = await createInvitation(db, arranger, { email: email(role), roles: [role] });
    const member = await signIn(email(role));
    service[role] = { ...member, roles: [...member.roles, ...(await acceptInvitation(db, member, invitation.token))] };
  }
  step(`Arranger ${arranger.email} signs in and invites the service parties into the console: compliance, SCAS partner, elevator, laboratory, regulator`);

  let farmer = await signIn(email("farmer"));
  farmer = { ...farmer, roles: await openAccount(db, farmer, "issuer") };
  await linkWallet(db, farmer, { address: d.wallets.farmer, kind: "privy-embedded" });
  await saveFarmerProfile(db, farmer, { legalName: "Demo Farm LLP", bin: "000000000000", region: "Demo region", contact: "Demo contact" });
  await submitFarmerKyc(db, farmer, await d.storeDocument(pdf("charter and director ID")));
  step(`Farmer signs up (${farmer.email}, fake company Demo Farm LLP) and submits issuer KYC; wallet ${d.wallets.farmer}`, [await d.fund(d.wallets.farmer, d.wallets.investor, 2 * REQUESTED_USD + 10)]);

  let investor = await signIn(email("investor"));
  investor = { ...investor, roles: await openAccount(db, investor, "investor") };
  await saveQuestionnaire(db, investor, { category: "professional", netAssets: "1m-10m", experience: "extensive", basis: "Demo professional investor" });
  await submitInvestorKyc(db, investor, { fullName: "Demo Investor", country: "Other", iin: "000000000000" });
  await acknowledgeRisk(db, investor);
  await linkWallet(db, investor, { address: d.wallets.investor, kind: "phantom" });
  await decideInvestorKyc(db, service.compliance, investor.id, "approved", null, chain);
  step(`Investor onboards (${investor.email}, fake IIN); compliance approves KYC on-chain for wallet ${d.wallets.investor}`);

  async function issue(label: string): Promise<{ app: ApplicationRow; poolId: string; detail: PoolDetail }> {
    const app = await createApplication(db, farmer, { crop: "wheat", grade: "3", volumeT: 100, tokenizedShareBps: 3000, requestedUsd: REQUESTED_USD, proposedCouponBps: 1200, season: 2027, elevator: "Demo elevator", lab: "Demo lab" });
    for (const kind of REQUIRED_KINDS) await addApplicationDocument(db, farmer, app.id, kind, await d.storeDocument(pdf(kind)));
    const reg = await d.registerFields(app);
    await recordUserTransaction(db, { action: "register-project", wallet: d.wallets.farmer, signature: reg.signature, pool: null, project: reg.project, amount: null }, null);
    await attachProject(db, farmer, app.id, reg.project, d.wallets.farmer, reg.fields.length ? await d.storeFieldSet(reg.fields) : undefined);
    await submitApplication(db, farmer, app.id);
    step(`Pool ${label}: farmer applies (wheat 2027, $${REQUESTED_USD.toLocaleString("en-US")}), uploads the term-sheet documents, registers fields on-chain and submits`, [reg.signature]);

    await advanceApplication(db, arranger, app.id, "documents_review", chain);
    for (const row of (await applicationDetail(db, app.id)).checklist) await reviewDocument(db, arranger, row.documentId as string, "accepted", null);
    await advanceApplication(db, arranger, app.id, "kyc", chain);
    if ((await farmerProfile(db, farmer.id))?.kycStatus !== "approved") {
      await decideFarmerKyc(db, service.compliance, farmer.id, "approved", null, chain);
      step("Compliance approves issuer KYC: the platform KYC record for the farmer's wallet goes on-chain");
    }
    await advanceApplication(db, arranger, app.id, "field_verification", chain);
    await breathe();
    const verified = await verifyApplicationFields(db, service.scas, app.id, chain);
    step(`Pool ${label}: the SCAS partner verifies the fields from its cabinet`, verified);
    await breathe();
    await advanceApplication(db, arranger, app.id, "structuring", chain);
    const terms = { ...termDefaults(app, 500), closeInMinutes: Math.max(1, Math.floor(d.maturityMinutes / 2)), maturityInMinutes: d.maturityMinutes, interestDays: 300 };
    const structured = await structureApplication(db, arranger, app.id, terms, chain);
    const poolId = structured.poolId as string;
    await publishApplication(db, arranger, app.id, chain);
    step(`Pool ${label}: arranger builds the term sheet (pool ${poolId}, Hybrid, coupon 12% Act/360, maturity in ${d.maturityMinutes} minutes, 300 days of demo interest) and publishes it`);

    await breathe();
    let detail = await chain.pool(poolId);
    if (!detail) throw new Error(`pool ${poolId} not found`);
    await acceptKfd(db, investor, detail.pool.address, kfdHash(buildKfd(detail, d.networkFee)));
    const amount = BigInt(REQUESTED_USD) * 1_000_000n;
    const sub = await d.subscribe(poolId, amount);
    await recordUserTransaction(db, { action: "subscribe", wallet: d.wallets.investor, signature: sub, pool: detail.pool.address, project: null, amount: amount.toString() }, { poolId, symbol: detail.pool.instrument?.symbol ?? poolId });
    const close = await d.closeSubscription(poolId);
    await audit(db, { actorUserId: arranger.id, action: "pool.close_subscription", targetType: "pool", targetId: poolId, signatures: [close] });
    const paid = await d.disburse(poolId);
    await audit(db, { actorUserId: arranger.id, action: "pool.disburse", targetType: "pool", targetId: poolId, signatures: paid });
    step(`Pool ${label}: investor accepts the key features and subscribes the whole issue with no SOL; arranger closes and disburses`, [sub, close, ...paid]);

    for (const kind of ["Sowing", "Vegetation", "Harvest"] as const) {
      await breathe();
      const sigs = await recordSeasonAttestation(db, service.scas, { poolId, kind, note: `Demo ${kind.toLowerCase()} check`, documentSha256: null, yieldEstimateTPerHa: kind === "Harvest" ? 3.2 : null }, chain);
      step(`Pool ${label}: SCAS partner records ${kind === "Harvest" ? "the pre-harvest yield estimate (3.2 t/ha)" : kind.toLowerCase()}`, sigs);
    }
    await breathe();
    const receipt = await recordElevatorReceipt(db, service.elevator, { poolId, tonnes: 30, receiptNumber: `DEMO-${stamp}-${label}`, receivedOn: "2027-08-20", documentSha256: (await d.storeDocument(pdf("elevator receipt"))).sha256 }, chain);
    const lab = await recordLabProtocol(db, service.lab, { poolId, measured: GOOD_LAB, documentSha256: (await d.storeDocument(pdf("lab protocol"))).sha256 }, chain, PILOT_QUALITY_SPEC);
    step(`Pool ${label}: elevator records 30 t received; laboratory records the 12-parameter protocol (passes)`, [receipt, lab]);
    detail = await chain.pool(poolId);
    if (!detail) throw new Error(`pool ${poolId} not found`);
    return { app, poolId, detail };
  }

  const a = await issue("A");
  const b = await issue("B");

  const electA = await d.elect(a.poolId, "Buyback");
  await recordUserTransaction(db, { action: "elect-settlement", wallet: d.wallets.farmer, signature: electA, pool: a.detail.pool.address, project: null, amount: null }, { poolId: a.poolId, symbol: a.detail.pool.instrument?.symbol ?? a.poolId });
  const due = redemptionDue(BigInt(a.detail.pool.raisedAmount), { yieldBps: a.detail.pool.yieldBps, maturityTs: a.detail.pool.maturityTs }, a.detail.terms ?? null);
  const short = due - (await d.vaultBalance(a.poolId));
  const mint = await d.mintToFarmer(short);
  const funded = await d.fundBuyback(a.poolId, short);
  await recordUserTransaction(db, { action: "fund-redemption", wallet: d.wallets.farmer, signature: funded, pool: a.detail.pool.address, project: null, amount: short.toString() }, { poolId: a.poolId, symbol: a.detail.pool.instrument?.symbol ?? a.poolId });
  step(`Pool A: farmer elects the buyback and funds ${short} base units (principal plus coupon) from the cabinet wallet`, [electA, mint, funded]);

  const electB = await d.elect(b.poolId, "Delivery");
  await recordUserTransaction(db, { action: "elect-settlement", wallet: d.wallets.farmer, signature: electB, pool: b.detail.pool.address, project: null, amount: null }, { poolId: b.poolId, symbol: b.detail.pool.instrument?.symbol ?? b.poolId });
  step("Pool B: farmer elects grain delivery", [electB]);

  // Holders before settlement, for the regulator's snapshot.
  const holdersBefore = [
    ...(await d.holders(a.detail.pool.mint)).map((h) => ({ poolId: a.poolId, ...h })),
    ...(await d.holders(b.detail.pool.mint)).map((h) => ({ poolId: b.poolId, ...h })),
  ];

  const maturity = Math.max(a.detail.pool.maturityTs, b.detail.pool.maturityTs);
  log(`Waiting for maturity (${new Date(maturity * 1000).toISOString()})`);
  await d.waitUntil(maturity + 5);

  const settled = await d.recordSettlement(a.poolId);
  await audit(db, { actorUserId: arranger.id, action: "pool.record_settlement", targetType: "pool", targetId: a.poolId, signatures: settled });
  const opened = await d.openRedemption(a.poolId);
  await audit(db, { actorUserId: arranger.id, action: "pool.fund_redemption", targetType: "pool", targetId: a.poolId, signatures: opened });
  step("Pool A: after maturity the arranger records the settlement and opens redemption", [...settled, ...opened]);
  const amount = BigInt(REQUESTED_USD) * 1_000_000n;
  const redeemed = await d.redeem(a.poolId, amount);
  await recordUserTransaction(db, { action: "redeem", wallet: d.wallets.investor, signature: redeemed, pool: a.detail.pool.address, project: null, amount: amount.toString() }, { poolId: a.poolId, symbol: a.detail.pool.instrument?.symbol ?? a.poolId });
  const swept = await d.sweep(a.poolId);
  await audit(db, { actorUserId: arranger.id, action: "pool.sweep", targetType: "pool", targetId: a.poolId, signatures: [swept] });
  step("Pool A: investor redeems for principal plus coupon in USDC; arranger sweeps the vault and closes", [redeemed, swept]);

  const claimed = await d.redeemDelivery(b.poolId, amount);
  await recordUserTransaction(db, { action: "redeem-delivery", wallet: d.wallets.investor, signature: claimed, pool: b.detail.pool.address, project: null, amount: amount.toString() }, { poolId: b.poolId, symbol: b.detail.pool.instrument?.symbol ?? b.poolId });
  step("Pool B: investor burns the tokens for a Grain Claim (9 t of the 30 t tokenized share)", [claimed]);

  await breathe();
  await refreshChainStatuses(db, chain, d.now());
  const pools = await Promise.all([chain.pool(a.poolId), chain.pool(b.poolId)]);
  const views = pools.filter((p): p is PoolDetail => p !== null).map((p) => p.pool);
  const registry = await registryRows(db, views, new Map(views.map((v) => [v.poolId, holdersBefore.filter((h) => h.poolId === v.poolId).length])));
  const holders = await holderRows(db, holdersBefore);
  const events = (await eventRows(db, {})).filter((e) => e.targetId === a.poolId || e.targetId === b.poolId || e.detail.includes(a.detail.pool.address) || e.detail.includes(b.detail.pool.address));
  await d.writeExport("registry.csv", toCsv(["Pool", "Symbol", "Status", "Issuer wallet", "Issuer legal name", "Issuer BIN", "Raised", "Target", "Coupon (bps)", "Settlement", "Maturity", "Holders"], registry.map((r) => [r.poolId, r.symbol, r.status, r.issuerWallet, r.issuerLegalName, r.issuerBin, r.raised, r.target, r.couponBps, r.settlementMode, new Date(r.maturityTs * 1000).toISOString(), r.holders])));
  await d.writeExport("holders.csv", toCsv(["Pool", "Wallet", "Balance", "Category", "IIN"], holders.map((h) => [h.poolId, h.wallet, h.balance, h.category, h.iin])));
  await d.writeExport("events.csv", toCsv(["Time (UTC)", "Action", "Acting role", "Target type", "Target", "Transaction", "Detail"], events.map((e) => [e.at, e.action, e.actingRole, e.targetType, e.targetId, e.signature, e.detail])));
  step(`Regulator exports the registry (${registry.length} pools), holders before settlement (${holders.length}) and events (${events.length})`);

  const status = async (id: string) => (await applicationDetail(db, id)).application.status;
  return {
    buyback: { poolId: a.poolId, applicationId: a.app.id, status: await status(a.app.id) },
    delivery: { poolId: b.poolId, applicationId: b.app.id, status: await status(b.app.id), claimed: Boolean(claimed) },
    emails: { arranger: arranger.email, farmer: farmer.email, investor: investor.email, ...Object.fromEntries(Object.entries(service).map(([k, v]) => [k, v.email])) },
  };
}
