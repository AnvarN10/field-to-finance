import { describe, expect, it } from "vitest";
import { lifecycle } from "../src/lib/lifecycle";
import { NOW, poolDetail, projectWith } from "./helpers/pool";

const current = (p: ReturnType<typeof lifecycle>) => p.find((x) => x.state === "current");
const after = NOW + 31 * 86_400;
const DUE = 1_000_000_000n + (1_000_000_000n * 1200n * 31n) / 360_0000n;

describe("lifecycle", () => {
  it("open pool: investors subscribe; once full the arranger closes", () => {
    const open = current(lifecycle(poolDetail({ pool: { status: "Open", raisedAmount: "0", subscriptionCloseTs: NOW + 3_600 } }), NOW));
    expect(open).toMatchObject({ key: "subscription", owner: "investors" });
    expect(open).not.toHaveProperty("action");
    expect(current(lifecycle(poolDetail({ pool: { status: "Open" } }), NOW))).toMatchObject({ key: "subscription", owner: "arranger", action: "close_subscription" });
    expect(current(lifecycle(poolDetail({ pool: { status: "Open", raisedAmount: "1", subscriptionCloseTs: NOW - 1 } }), NOW))).toMatchObject({ action: "close_subscription" });
  });

  it("funded and not paid: the arranger disburses; earlier phases are done", () => {
    const p = lifecycle(poolDetail({ pool: { disbursedCount: 0 }, projects: [projectWith({ disbursed: false })] }), NOW);
    expect(current(p)).toMatchObject({ key: "funding", owner: "arranger", action: "disburse" });
    expect(p[0]?.state).toBe("done");
    expect(p.at(-1)?.state).toBe("todo");
  });

  it("disbursed, no harvest yet: the SCAS partner attests the season", () => {
    expect(current(lifecycle(poolDetail(), NOW))).toMatchObject({ key: "season", owner: "scas" });
  });

  it("harvest attested on the delivery path: elevator, then laboratory", () => {
    const harvested = [projectWith({ harvestAttested: true })];
    expect(current(lifecycle(poolDetail({ projects: harvested }), NOW))).toMatchObject({ key: "harvest", owner: "elevator" });
    expect(current(lifecycle(poolDetail({ projects: harvested, terms: { receiptHash: "aa".repeat(32) } }), NOW))).toMatchObject({ key: "harvest", owner: "lab" });
  });

  it("documents in, no election: the farmer elects; buyback elected and short: the farmer funds", () => {
    const harvested = [projectWith({ harvestAttested: true })];
    const docs = { receiptHash: "aa".repeat(32), labCertHash: "bb".repeat(32), labPassed: true };
    expect(current(lifecycle(poolDetail({ projects: harvested, terms: docs }), NOW))).toMatchObject({ key: "settlement", owner: "farmer", next: expect.stringMatching(/Elect/) });
    expect(current(lifecycle(poolDetail({ projects: harvested, terms: { election: "Buyback" } }), NOW, 0n))).toMatchObject({ key: "settlement", owner: "farmer", next: expect.stringMatching(/Fund the buyback/) });
  });

  it("buyback after maturity: the arranger records settlement, then opens redemption", () => {
    const t = { election: "Buyback" as const };
    expect(current(lifecycle(poolDetail({ terms: t }), after, DUE))).toMatchObject({ key: "settlement", owner: "arranger", action: "record_settlement" });
    const settled = poolDetail({ terms: t, pool: { settledCount: 1 }, projects: [projectWith({ settlement: "CashRepaidWithPremium" })] });
    expect(current(lifecycle(settled, after, DUE))).toMatchObject({ owner: "arranger", action: "open_redemption" });
    expect(current(lifecycle(settled, after, 0n))).toMatchObject({ owner: "farmer" });
  });

  it("redeeming: holders redeem, then the arranger sweeps, then everything is done", () => {
    expect(current(lifecycle(poolDetail({ pool: { status: "Redeeming" } }), after))).toMatchObject({ key: "settlement", owner: "investors" });
    const empty = poolDetail({ pool: { status: "Redeeming", instrument: { name: "", symbol: "DWHT27", uri: "", supply: "0", decimals: 6 } } });
    expect(current(lifecycle(empty, after, 5n))).toMatchObject({ key: "closing", owner: "arranger", action: "sweep" });
    expect(lifecycle(empty, after, 0n).every((x) => x.state === "done")).toBe(true);
  });

  it("delivery after maturity with both documents: holders claim grain", () => {
    const docs = { election: "Delivery" as const, receiptHash: "aa".repeat(32), labCertHash: "bb".repeat(32), labPassed: true };
    expect(current(lifecycle(poolDetail({ terms: docs, projects: [projectWith({ harvestAttested: true })] }), after))).toMatchObject({ key: "settlement", owner: "investors", next: expect.stringMatching(/claim grain/) });
  });

  it("refunding: holders take refunds", () => {
    expect(current(lifecycle(poolDetail({ pool: { status: "Refunding" } }), after))).toMatchObject({ key: "closing", owner: "investors" });
  });
});
