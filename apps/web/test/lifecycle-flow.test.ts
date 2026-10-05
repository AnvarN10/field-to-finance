import { describe, expect, it } from "vitest";
import type { PoolDetail } from "../src/lib/chain/views";
import { auditLog, notifications } from "../src/lib/db/schema";
import { runLifecycleFlow, type LifecycleFlowDeps } from "../src/lib/demo/lifecycle-flow";
import { testDb } from "./helpers/db";
import { poolDetail, projectWith } from "./helpers/pool";
import { doc, fakeChain, project } from "./helpers/workflow";

const FARMER = "Farmer1111111111111111111111111111111111111";
const INVESTOR = "9nvestor1111111111111111111111111111111111";

/** An in-memory devnet: two pools whose state the fake steps move along. */
function fakeWorld() {
  const pools = new Map<string, { status: PoolDetail["pool"]["status"]; disbursed: boolean; election: "Buyback" | "Delivery" | null; receipt: boolean; lab: boolean; settled: boolean; supply: string; vault: bigint; harvest: boolean }>();
  let next = 21;
  let clock = 1_000_000;
  const detail = (id: string): PoolDetail | null => {
    const s = pools.get(id);
    if (!s) return null;
    return poolDetail({
      pool: { poolId: id, address: `Poo1${id}`.padEnd(44, "1"), issuer: FARMER, status: s.status, maturityTs: clock + (s.status === "Funded" ? 600 : 6000), raisedAmount: "2000000000", targetAmount: "2000000000", disbursedCount: s.disbursed ? 1 : 0, settledCount: s.settled ? 1 : 0, instrument: { name: "", symbol: `WHE${id}`, uri: "", supply: s.supply, decimals: 6 } },
      terms: { startTs: clock - 300 * 86_400, election: s.election, receiptHash: s.receipt ? "aa".repeat(32) : null, labCertHash: s.lab ? "bb".repeat(32) : null, labPassed: s.lab },
      projects: [projectWith({ disbursed: s.disbursed, harvestAttested: s.harvest, settlement: s.settled ? "CashRepaidWithPremium" : null })],
    });
  };
  const verified = new Set<string>();
  const chain = fakeChain({
    project: async (address) => project({ address, producer: FARMER, verifiedFieldCount: verified.has(address) ? 2 : 0 }),
    verifyFields: async (p) => {
      verified.add(p.address);
      return ["sig-verify"];
    },
    createTermPool: async (input) => {
      pools.set(input.poolId, { status: "Draft", disbursed: false, election: null, receipt: false, lab: false, settled: false, supply: "0", vault: 0n, harvest: false });
      return { poolId: input.poolId, poolAddress: `Poo1${input.poolId}`.padEnd(44, "1"), signature: "sig-create" };
    },
    openPool: async (id) => {
      pools.get(id)!.status = "Open";
      return "sig-open";
    },
    nextPoolId: async () => String(next++),
    pool: async (id) => detail(id),
    attest: async (input) => {
      if (input.kind === "Harvest") pools.get(input.poolId)!.harvest = true;
      return [`sig-${input.kind}`];
    },
    recordDelivery: async (id, e) => {
      const s = pools.get(id)!;
      if (e.kind === "ElevatorReceipt") s.receipt = true;
      else s.lab = e.verdict === "Pass";
      return { signature: `sig-${e.kind}`, evidenceHash: "ee".repeat(32) };
    },
  });
  let n = 0;
  const projects = ["ProjA111111111111111111111111111111111111111", "ProjB111111111111111111111111111111111111111"];
  const files: Record<string, string> = {};
  const deps: LifecycleFlowDeps = {
    db: undefined as never,
    chain,
    storeDocument: async () => doc(Math.floor(Math.random() * 1e9)),
    storeFieldSet: async () => "f".repeat(64),
    fund: async () => "sig-fund",
    mintToFarmer: async () => "sig-mint",
    registerFields: async () => ({ project: projects[n++]!, signature: "sig-register", fields: [] }),
    networkFee: "500000",
    subscribe: async (id) => {
      pools.get(id)!.supply = "2000000000";
      return "sig-subscribe";
    },
    closeSubscription: async (id) => {
      pools.get(id)!.status = "Funded";
      return "sig-close";
    },
    disburse: async (id) => {
      pools.get(id)!.disbursed = true;
      return ["sig-disburse"];
    },
    elect: async (id, election) => {
      pools.get(id)!.election = election;
      return `sig-elect-${election}`;
    },
    fundBuyback: async (id) => {
      pools.get(id)!.vault = 2_200_000_000n;
      return "sig-fund-buyback";
    },
    vaultBalance: async (id) => pools.get(id)!.vault,
    recordSettlement: async (id) => {
      pools.get(id)!.settled = true;
      return ["sig-settle"];
    },
    openRedemption: async (id) => {
      pools.get(id)!.status = "Redeeming";
      return ["sig-open-redemption"];
    },
    redeem: async (id) => {
      pools.get(id)!.supply = "0";
      return "sig-redeem";
    },
    redeemDelivery: async (id) => {
      pools.get(id)!.supply = "0";
      return "sig-claim";
    },
    sweep: async () => "sig-sweep",
    holders: async () => [{ wallet: INVESTOR, balance: "2000000000" }],
    waitUntil: async (ts) => {
      clock = Math.max(clock, ts + 1);
    },
    writeExport: async (name, csv) => {
      files[name] = csv;
    },
    wallets: { farmer: FARMER, investor: INVESTOR },
    tx: (s) => `https://explorer/${s}`,
    now: () => clock,
    maturityMinutes: 10,
  };
  return { deps, files, pools };
}

describe("runLifecycleFlow", () => {
  it("walks every cabinet: buyback ending in redemption and sweep, delivery ending in a grain claim, regulator exports", async () => {
    const db = await testDb();
    const w = fakeWorld();
    const steps: string[] = [];
    const r = await runLifecycleFlow({ ...w.deps, db }, (l) => steps.push(l), "test");
    expect(r.buyback.status).toBe("closed");
    expect(r.delivery.claimed).toBe(true);
    expect(Object.keys(w.files).sort()).toEqual(["events.csv", "holders.csv", "registry.csv"]);
    expect(w.files["registry.csv"]).toContain("Demo Farm LLP");
    const audit = await db.select().from(auditLog);
    const roles = new Set(audit.map((a) => a.actingRole).filter(Boolean));
    expect([...roles].sort()).toEqual(["compliance", "elevator", "lab", "scas"]);
    for (const a of ["tx.elect-settlement", "tx.fund-redemption", "tx.redeem", "tx.redeem-delivery", "pool.record_settlement", "pool.sweep"]) expect(audit.map((x) => x.action)).toContain(a);
    expect((await db.select().from(notifications)).length).toBeGreaterThan(10);
    expect(steps.join("\n")).toMatch(/https:\/\/explorer\/sig-claim/);
  });
});
