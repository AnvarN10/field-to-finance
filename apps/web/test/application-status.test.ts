import { describe, expect, it } from "vitest";
import { canTransition, deriveFromChain, isChainDerived, STATUS_INFO, timeline, APPLICATION_STATUSES } from "../src/lib/application-status";

type D = Parameters<typeof deriveFromChain>[0];
const detail = (pool: Partial<D["pool"]> = {}, projects: D["projects"] = [{ disbursed: false, harvestAttested: false, fields: [{ attestationCount: 1 }] }]): D => ({
  pool: { status: "Funded", maturityTs: 2_000, projectCount: 1, disbursedCount: 0, instrument: { supply: "5" }, ...pool } as D["pool"],
  projects,
});

describe("canTransition", () => {
  it("allows the manual pipeline steps in order", () => {
    expect(canTransition("draft", "submitted")).toBe(true);
    expect(canTransition("submitted", "documents_review")).toBe(true);
    expect(canTransition("documents_review", "kyc")).toBe(true);
    expect(canTransition("kyc", "field_verification")).toBe(true);
    expect(canTransition("field_verification", "structuring")).toBe(true);
    expect(canTransition("structuring", "ready")).toBe(true);
    expect(canTransition("ready", "open")).toBe(true);
  });
  it("refuses skips, moves into chain-derived statuses other than publish, and moves out of them", () => {
    expect(canTransition("submitted", "open")).toBe(false);
    expect(canTransition("draft", "kyc")).toBe(false);
    expect(canTransition("open", "funded")).toBe(false);
    expect(canTransition("open", "withdrawn")).toBe(false);
    expect(canTransition("funded", "rejected")).toBe(false);
  });
  it("allows reject and withdraw only before open, and nothing after them", () => {
    expect(canTransition("kyc", "rejected")).toBe(true);
    expect(canTransition("draft", "withdrawn")).toBe(true);
    expect(canTransition("ready", "withdrawn")).toBe(true);
    expect(canTransition("draft", "rejected")).toBe(false);
    expect(canTransition("rejected", "draft")).toBe(false);
    expect(canTransition("withdrawn", "submitted")).toBe(false);
  });
});

describe("deriveFromChain", () => {
  it("keeps the stored status for a Draft pool", () => expect(deriveFromChain(detail({ status: "Draft" }), 1_000)).toBeNull());
  it("maps Open to open", () => expect(deriveFromChain(detail({ status: "Open" }), 1_000)).toBe("open"));
  it("is funded until every project is paid", () => expect(deriveFromChain(detail(), 1_000)).toBe("funded"));
  it("is disbursed once paid with no season attestation", () => expect(deriveFromChain(detail({ disbursedCount: 1 }), 1_000)).toBe("disbursed"));
  it("is in season once a field has more than its verification attestation", () =>
    expect(deriveFromChain(detail({ disbursedCount: 1 }, [{ disbursed: true, harvestAttested: false, fields: [{ attestationCount: 2 }] }]), 1_000)).toBe("in_season"));
  it("is harvest once harvest is attested", () =>
    expect(deriveFromChain(detail({ disbursedCount: 1 }, [{ disbursed: true, harvestAttested: true, fields: [{ attestationCount: 4 }] }]), 1_000)).toBe("harvest"));
  it("is settlement from maturity on and while Redeeming with tokens outstanding", () => {
    expect(deriveFromChain(detail({ disbursedCount: 1 }), 2_000)).toBe("settlement");
    expect(deriveFromChain(detail({ status: "Redeeming" }), 3_000)).toBe("settlement");
  });
  it("is closed once Redeeming with no tokens left, or Refunding", () => {
    expect(deriveFromChain(detail({ status: "Redeeming", instrument: { supply: "0" } as never }), 3_000)).toBe("closed");
    expect(deriveFromChain(detail({ status: "Refunding" }), 1_000)).toBe("closed");
  });
});

describe("status info and timeline", () => {
  it("has a label, owner and next action for every status", () => {
    for (const s of APPLICATION_STATUSES) expect(STATUS_INFO[s].label.length).toBeGreaterThan(0);
    expect(STATUS_INFO.draft.owner).toBe("farmer");
    expect(STATUS_INFO.documents_review.owner).toBe("arranger");
    expect(STATUS_INFO.open.owner).toBe("investors");
  });
  it("marks done, current and todo steps", () => {
    const t = timeline("kyc");
    expect(t.find((s) => s.status === "submitted")?.state).toBe("done");
    expect(t.find((s) => s.status === "kyc")?.state).toBe("current");
    expect(t.find((s) => s.status === "closed")?.state).toBe("todo");
    expect(t).toHaveLength(14);
  });
  it("chain-derived statuses are open through closed", () => {
    expect(isChainDerived("open")).toBe(true);
    expect(isChainDerived("ready")).toBe(false);
  });
});
