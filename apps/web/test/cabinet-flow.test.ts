import { describe, expect, it } from "vitest";
import { runCabinetFlow } from "../src/lib/demo/cabinet-flow";
import { auditLog, kfdAcceptances } from "../src/lib/db/schema";
import { testDb } from "./helpers/db";
import { doc, fakeChain, project } from "./helpers/workflow";

const FARMER = "Farmer1111111111111111111111111111111111111";
const INVESTOR = "9nvestor1111111111111111111111111111111111";
const PROJECT = "Project111111111111111111111111111111111111";

describe("runCabinetFlow", () => {
  it("walks signup, application, review, KYC, verification, structuring, publish, onboarding, KFD, subscribe and disburse", async () => {
    const db = await testDb();
    const steps: string[] = [];
    let verified = false;
    let pool: "Draft" | "Open" | "Funded" = "Draft";
    let disbursed = 0;
    const chain = fakeChain({
      project: async () => project({ address: PROJECT, producer: FARMER, verifiedFieldCount: verified ? 2 : 0 }),
      verifyFields: async () => {
        verified = true;
        return ["sig-verify"];
      },
      openPool: async () => {
        pool = "Open";
        return "sig-open";
      },
      pool: async (id) =>
        ({
          pool: { address: `Poo1${id}111111111111111111111111111111111111`.slice(0, 44), poolId: id, issuer: FARMER, status: pool, maturityTs: 4_000_000_000, subscriptionCloseTs: 3_900_000_000, projectCount: 1, disbursedCount: disbursed, targetAmount: "20000000000", yieldBps: 1200, instrument: { supply: "20000000000", symbol: "WHE27", name: "Wheat" } },
          projects: [{ disbursed: disbursed > 0, harvestAttested: false, fields: [{ attestationCount: 1 }] }],
          terms: null,
          arrangementFeeBps: 200,
        }) as never,
    });
    const r = await runCabinetFlow(
      {
        db,
        chain,
        storeDocument: async () => doc(Math.floor(Math.random() * 1e9)),
        storeFieldSet: async () => "f".repeat(64),
        fund: async () => "sig-fund",
        registerFields: async () => ({ project: PROJECT, signature: "sig-register", fields: [] }),
        networkFee: "500000",
        subscribe: async () => {
          pool = "Funded";
          return "sig-subscribe";
        },
        closeSubscription: async () => "sig-close",
        disburse: async () => {
          disbursed = 1;
          return ["sig-disburse"];
        },
        wallets: { farmer: FARMER, investor: INVESTOR },
        tx: (s) => `https://explorer/${s}`,
        now: () => 1_000,
      },
      (line) => steps.push(line),
      "test",
    );
    expect(r.status).toBe("disbursed");
    expect(steps.join("\n")).toMatch(/Farmer applies through \/apply/);
    expect(steps.join("\n")).toMatch(/https:\/\/explorer\/sig-subscribe/);
    expect(await db.select().from(kfdAcceptances)).toHaveLength(1);
    const actions = (await db.select().from(auditLog)).map((a) => a.action);
    for (const a of ["application.submit", "document.accept", "farmer_kyc.approve", "fields.verify", "pool.create", "pool.open", "investor_kyc.approve", "kfd.accept", "tx.subscribe", "pool.disburse"]) expect(actions).toContain(a);
  });
});
