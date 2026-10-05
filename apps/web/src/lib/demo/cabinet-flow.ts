import { desc, eq } from "drizzle-orm";
import { createPrivyPort } from "../auth/privy-port";
import { signInWithToken, type SessionUser } from "../auth/session";
import type { Db } from "../db/client";
import { auditLog, type ApplicationRow } from "../db/schema";
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
import { REQUIRED_KINDS } from "../workflow/documents";
import { addApplicationDocument, attachProject, createApplication, saveFarmerProfile, submitApplication, submitFarmerKyc } from "../workflow/farmer";
import { acceptKfd, acknowledgeRisk, kfdGate, linkWallet, saveQuestionnaire, submitInvestorKyc } from "../workflow/investor";
import type { ArrangerChain, StoredDocInput } from "../workflow/ports";
import { chooseRole } from "../workflow/users";

/** Everything the walk needs from the outside world; the devnet script wires real keys, the test wires fakes. */
export interface CabinetFlowDeps {
  db: Db;
  chain: ArrangerChain;
  storeDocument(bytes: Uint8Array): Promise<StoredDocInput>;
  storeFieldSet(fields: FieldSetEntry[]): Promise<string>;
  /** Test USDC for the farmer (mint fee) and the investor (the whole issue plus the network fee). */
  fund(farmer: string, investor: string, investorUsd: number): Promise<string>;
  /** register_project + register_field, signed by the farmer's wallet, sponsored. */
  registerFields(app: ApplicationRow): Promise<{ project: string; signature: string; fields: FieldSetEntry[] }>;
  networkFee: string | null;
  /** subscribe, signed by the investor's wallet, sponsored. */
  subscribe(poolId: string, amount: bigint): Promise<string>;
  closeSubscription(poolId: string): Promise<string>;
  disburse(poolId: string): Promise<string[]>;
  wallets: { farmer: string; investor: string };
  tx(signature: string): string;
  now(): number;
  /** Pause between heavy reads (public devnet RPC rate limits). */
  breathe?(): Promise<void>;
}

const REQUESTED_USD = 20_000;
const pdf = (title: string) => new TextEncoder().encode(`%PDF-1.4\n% Field-to-Finance demo document, fake data only: ${title}\n%%EOF\n`);

/**
 * The cabinets end to end, through the same workflow code the server actions call: a farmer signs up and applies, the
 * arranger reviews, approves KYC on-chain, verifies fields and structures the pool, an investor onboards, accepts the
 * KFD and subscribes, the arranger disburses. Uses obviously fake identities (example.com, BIN 000000000000).
 */
export async function runCabinetFlow(d: CabinetFlowDeps, log: (line: string) => void, stamp: string) {
  let n = 0;
  const step = (title: string, sigs: (string | null | undefined)[] = []) => {
    log(`Step ${++n}: ${title}`);
    for (const s of sigs) if (s) log(`         ${d.tx(s)}`);
  };
  const breathe = d.breathe ?? (async () => {});
  const { db, chain } = d;
  // Same sign-in path as the browser, with the dev verifier (dev:<email>) instead of Privy's email code.
  const privy = createPrivyPort({ appId: undefined, appSecret: undefined, devAuth: true, nodeEnv: "development" });
  const signIn = async (email: string, arrangers: string[] = []): Promise<SessionUser> => (await signInWithToken(db, privy, `dev:${email}`, arrangers)).user;

  const arrangerEmail = `demo+arranger-${stamp}@example.com`;
  const arranger = await signIn(arrangerEmail, [arrangerEmail]);
  step(`Arranger ${arrangerEmail} signs in; ARRANGER_EMAILS bootstrap grants the role (${arranger.roles.join(", ")})`);

  // Farmer
  const farmerEmail = `demo+farmer-${stamp}@example.com`;
  let farmer = await signIn(farmerEmail);
  farmer = { ...farmer, roles: await chooseRole(db, farmer, "farmer") };
  await linkWallet(db, farmer, { address: d.wallets.farmer, kind: "privy-embedded" });
  step(`Farmer signs up as ${farmerEmail} and chooses "I am a farmer"; issuer wallet ${d.wallets.farmer}`);
  step("Deployer sends test USDC: the farmer's mint fee and the investor's subscription", [await d.fund(d.wallets.farmer, d.wallets.investor, REQUESTED_USD + 10)]);

  await saveFarmerProfile(db, farmer, { legalName: "Demo Farm LLP", bin: "000000000000", region: "Demo region", contact: "Demo contact" });
  await submitFarmerKyc(db, farmer, await d.storeDocument(pdf("charter and director ID")));
  step("Farmer fills in the company profile (fake data) and uploads issuer KYC documents to the private bucket");

  const app = await createApplication(db, farmer, {
    crop: "wheat",
    grade: "3",
    volumeT: 100,
    tokenizedShareBps: 3000,
    requestedUsd: REQUESTED_USD,
    proposedCouponBps: 1200,
    season: 2027,
    elevator: "Demo elevator",
    lab: "Demo lab",
  });
  for (const kind of REQUIRED_KINDS) await addApplicationDocument(db, farmer, app.id, kind, await d.storeDocument(pdf(kind)));
  step(`Farmer creates application ${app.id} (wheat 2027, $20,000, coupon 12%) and uploads the ${REQUIRED_KINDS.length} term-sheet documents`);

  const reg = await d.registerFields(app);
  await audit(db, { actorUserId: farmer.id, action: "tx.register-project", targetType: "wallet", targetId: d.wallets.farmer, payload: { project: reg.project }, signatures: [reg.signature] });
  await attachProject(db, farmer, app.id, reg.project, d.wallets.farmer, reg.fields.length ? await d.storeFieldSet(reg.fields) : undefined);
  step(`Farmer registers the fields on-chain with the sponsored register_project (project ${reg.project}) and links it`, [reg.signature]);
  await submitApplication(db, farmer, app.id);
  step("Farmer submits the application");

  // Arranger
  await advanceApplication(db, arranger, app.id, "documents_review", chain);
  for (const row of (await applicationDetail(db, app.id)).checklist) await reviewDocument(db, arranger, row.documentId as string, "accepted", null);
  await advanceApplication(db, arranger, app.id, "kyc", chain);
  step("Arranger reviews and accepts every document");

  await decideFarmerKyc(db, arranger, farmer.id, "approved", null, chain);
  await advanceApplication(db, arranger, app.id, "field_verification", chain);
  step("Arranger approves issuer KYC: compliance writes the platform KYC record for the farmer's wallet", [await lastSignature(db, "farmer_kyc.approve")]);

  await breathe();
  const verified = await verifyApplicationFields(db, arranger, app.id, chain);
  step("Arranger verifies the fields with the SCAS stub", verified);
  await breathe();
  await advanceApplication(db, arranger, app.id, "structuring", chain);

  await breathe();
  const terms = { ...termDefaults(app, 500), closeInMinutes: 60, maturityInMinutes: 60 * 24 * 30 };
  const structured = await structureApplication(db, arranger, app.id, terms, chain);
  step(`Arranger builds the terms: pool ${structured.poolId} with InstrumentTerms, farmer as issuer of record, project added`, [
    await lastSignature(db, "pool.create"),
    await lastSignature(db, "pool.add_project"),
  ]);
  await publishApplication(db, arranger, app.id, chain);
  const poolId = structured.poolId as string;
  step(`Arranger publishes pool ${poolId}: open for subscription`, [await lastSignature(db, "pool.open")]);

  // Investor
  const investorEmail = `demo+investor-${stamp}@example.com`;
  let investor = await signIn(investorEmail);
  investor = { ...investor, roles: await chooseRole(db, investor, "investor") };
  await saveQuestionnaire(db, investor, { category: "professional", netAssets: "1m-10m", experience: "extensive", basis: "Demo professional investor" });
  await submitInvestorKyc(db, investor, { fullName: "Demo Investor", country: "Other" });
  await acknowledgeRisk(db, investor);
  await linkWallet(db, investor, { address: d.wallets.investor, kind: "phantom" });
  step(`Investor signs up as ${investorEmail}: professional category, mock KYC, risk acknowledgement, wallet ${d.wallets.investor} linked`);
  await decideInvestorKyc(db, arranger, investor.id, "approved", null, chain);
  step("Arranger approves the investor's KYC: compliance writes the platform KYC record for the linked wallet", [await lastSignature(db, "investor_kyc.approve")]);

  await breathe();
  const detail = await chain.pool(poolId);
  if (!detail) throw new Error(`pool ${poolId} not found`);
  const before = await kfdGate(db, d.wallets.investor, detail.pool.address);
  await acceptKfd(db, investor, detail.pool.address, kfdHash(buildKfd(detail, d.networkFee)));
  const after = await kfdGate(db, d.wallets.investor, detail.pool.address);
  step(`Investor reads and accepts the key features document (subscribe gate: ${before} before, ${after ?? "open"} after)`);

  const amount = BigInt(REQUESTED_USD) * 1_000_000n;
  const sub = await d.subscribe(poolId, amount);
  await audit(db, { actorUserId: investor.id, action: "tx.subscribe", targetType: "wallet", targetId: d.wallets.investor, payload: { pool: detail.pool.address, amount: amount.toString() }, signatures: [sub] });
  step("Investor subscribes the whole issue with no SOL: the sponsor pays fee and rent", [sub]);

  const close = await d.closeSubscription(poolId);
  await audit(db, { actorUserId: arranger.id, action: "pool.close_subscription", targetType: "pool", targetId: poolId, signatures: [close] });
  step("Pool reaches its target; subscription closes as Funded", [close]);
  const paid = await d.disburse(poolId);
  await audit(db, { actorUserId: arranger.id, action: "pool.disburse", targetType: "pool", targetId: poolId, signatures: paid });
  step("Arranger disburses the proceeds to the farmer, arrangement fee withheld for the treasury", paid);

  await breathe();
  await refreshChainStatuses(db, chain, d.now());
  const final = (await applicationDetail(db, app.id)).application.status;
  step(`Application status derived from the chain: ${final}`);
  return { applicationId: app.id, poolId, status: final, emails: { arranger: arrangerEmail, farmer: farmerEmail, investor: investorEmail } };
}

async function lastSignature(db: Db, action: string): Promise<string | null> {
  const [row] = await db.select({ sig: auditLog.txSignature }).from(auditLog).where(eq(auditLog.action, action)).orderBy(desc(auditLog.createdAt)).limit(1);
  return row?.sig ?? null;
}
