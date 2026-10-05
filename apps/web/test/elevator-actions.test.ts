import { describe, expect, it, vi } from "vitest";
import { RequestError } from "../src/lib/errors";
import { MemoryStore } from "../src/lib/store";
import { assertServiceRole } from "../src/lib/workflow/guards";
import { testDb } from "./helpers/db";
import { poolDetail } from "./helpers/pool";
import { fakeChain, makeUser } from "./helpers/workflow";

const db = await testDb();
const elevator = await makeUser(db, "el@example.com", ["elevator"]);
const lab = await makeUser(db, "lab@example.com", ["lab"]);
const regulator = await makeUser(db, "reg@example.com", ["regulator"]);
const store = new MemoryStore();
let actor: unknown = elevator;
const chain = fakeChain({ pool: async () => poolDetail() });
vi.mock("@/lib/server/auth", () => ({
  requireServiceAction: async (role: "elevator" | "lab") => {
    if (!actor) throw new RequestError("Your session expired. Sign in again.", 401);
    return assertServiceRole(actor as never, role);
  },
}));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/chain-port", () => ({ arrangerChain: () => chain }));
vi.mock("@/lib/server/context", () => ({ invalidateReads: () => {}, getStore: () => store }));
const actions = await import("../src/app/elevator/actions");

const pdf = () => new File([new TextEncoder().encode(`%PDF-1.4 ${Math.random()}`)], "doc.pdf", { type: "application/pdf" });
const form = (fields: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const receipt = () => form({ tonnes: "950", receiptNumber: "RCPT-000-DEMO", receivedOn: "2027-08-20", file: pdf() });

describe("elevator and lab actions", () => {
  it("refuse signed-out, regulator and cross-lane callers; nothing is recorded", async () => {
    actor = null;
    expect(await actions.recordReceiptAction("9", receipt())).toMatchObject({ ok: false, error: { title: "Your session expired. Sign in again." } });
    actor = regulator;
    expect(await actions.recordReceiptAction("9", receipt())).toMatchObject({ ok: false, error: { title: "Your account does not have the elevator role." } });
    actor = lab;
    expect(await actions.recordReceiptAction("9", receipt())).toMatchObject({ ok: false });
    actor = elevator;
    expect(await actions.recordLabAction("9", form({ protein: "15", file: pdf() }))).toMatchObject({ ok: false, error: { title: "Your account does not have the lab role." } });
    expect(chain.calls).toEqual([]);
  });

  it("record a receipt as the elevator and a protocol as the lab", async () => {
    actor = elevator;
    expect(await actions.recordReceiptAction("9", receipt())).toMatchObject({ ok: true, signatures: ["sig-ElevatorReceipt"] });
    actor = lab;
    expect(await actions.recordLabAction("9", form({ protein: "15.5", file: pdf() }))).toMatchObject({ ok: true });
    expect(chain.calls).toEqual(["recordDelivery:9:ElevatorReceipt:Pass", "recordDelivery:9:LabQuality:InsufficientData"]);
  });

  it("explain a missing file", async () => {
    actor = elevator;
    expect(await actions.recordReceiptAction("9", form({ tonnes: "950", receiptNumber: "R1", receivedOn: "2027-08-20" }))).toMatchObject({ ok: false, error: { title: "Choose a file" } });
  });
});
