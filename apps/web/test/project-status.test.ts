import { describe, expect, it } from "vitest";
import type { ProducerProject } from "../src/lib/chain/views";
import { projectStatus } from "../src/lib/project-status";

const p = (o: Partial<ProducerProject>): ProducerProject =>
  ({ fieldCount: 2, verifiedFieldCount: 0, pool: null, poolStatus: null, poolId: null, symbol: null, disbursed: false, settlement: null, requestedAmount: "2000000000", fields: [], ...o }) as ProducerProject;

describe("projectStatus", () => {
  it("walks the financing lifecycle in plain words", () => {
    expect(projectStatus(p({}))).toEqual({ label: "Waiting for field checks (0 of 2 verified)", tone: "pending" });
    expect(projectStatus(p({ verifiedFieldCount: 2 }))).toEqual({ label: "Verified. Waiting to join a pool", tone: "progress" });
    expect(projectStatus(p({ verifiedFieldCount: 2, pool: "X", poolStatus: "Draft", symbol: "WHEAT-2027" }))).toEqual({ label: "In WHEAT-2027, opening soon", tone: "progress" });
    expect(projectStatus(p({ verifiedFieldCount: 2, pool: "X", poolStatus: "Open", symbol: "WHEAT-2027" }))).toEqual({ label: "In WHEAT-2027, raising from investors", tone: "progress" });
    expect(projectStatus(p({ verifiedFieldCount: 2, pool: "X", poolStatus: "Funded", disbursed: true, symbol: "WHEAT-2027" }))).toEqual({ label: "Funded. $2,000.00 paid to you", tone: "success" });
    expect(projectStatus(p({ pool: "X", poolStatus: "Refunding", symbol: "WHEAT-2027" }))).toEqual({ label: "WHEAT-2027 did not reach its target; investors are refunded", tone: "warning" });
    expect(projectStatus(p({ pool: "X", poolStatus: "Redeeming", disbursed: true, settlement: "Delivered", symbol: "WHEAT-2027" }))).toEqual({ label: "Settled: Delivered in full", tone: "success" });
  });
});
