import { beforeEach, describe, expect, it, vi } from "vitest";
import { SponsorRejected } from "../../src/lib/chain/sponsor";

const cosignAndSend = vi.fn();
let sponsor: object | null = {};
vi.mock("@/lib/server/context", () => ({
  getConnection: () => ({}),
  roleKeypair: () => ({}),
  sponsorPolicy: async () => ({}),
  sponsorPublicKey: () => sponsor,
  getStore: () => ({ get: async () => null }),
}));
vi.mock("@/lib/chain/sponsor", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/chain/sponsor")>()),
  cosignAndSend: (...a: unknown[]) => cosignAndSend(...a),
}));
const recordTx = vi.fn(async () => {});
vi.mock("@/lib/server/tx-history", () => ({ recordUserTx: (...a: unknown[]) => recordTx(...(a as [])) }));
const { POST } = await import("../../src/app/api/tx/send/route");

const req = (body: unknown, ip = "4.4.4.4") =>
  new Request("http://x/api/tx/send", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) });

beforeEach(() => {
  cosignAndSend.mockReset();
  sponsor = {};
});

describe("POST /api/tx/send", () => {
  it("records the sent transaction in the history of the wallet's owner", async () => {
    cosignAndSend.mockImplementation(async (deps: { onSent?: (i: unknown, s: string) => void }) => {
      deps.onSent?.({ signer: { toBase58: () => "W1" }, summary: { pool: "P1", project: null, amount: "5" } }, "5sig");
      return "5sig";
    });
    await POST(req({ action: "subscribe", tx: "AAAA" }, "6.6.6.6"));
    await new Promise((r) => setTimeout(r, 0));
    expect(recordTx).toHaveBeenCalledWith({ action: "subscribe", wallet: "W1", signature: "5sig", pool: "P1", project: null, amount: "5" });
  });

  it("returns the signature of a co-signed transaction", async () => {
    cosignAndSend.mockResolvedValue("5sig");
    const r = await POST(req({ action: "subscribe", tx: "AAAA" }));
    expect(await r.json()).toEqual({ ok: true, signature: "5sig" });
  });

  it("answers 400 when the validator rejects, with the reason", async () => {
    cosignAndSend.mockRejectedValue(new SponsorRejected("fee payer must be the gas sponsor"));
    const r = await POST(req({ action: "subscribe", tx: "AAAA" }, "5.5.5.5"));
    expect(r.status).toBe(400);
    expect((await r.json()).error.detail).toMatch(/fee payer/);
  });

  it("rejects unknown actions before touching the sponsor", async () => {
    expect((await POST(req({ action: "disburse", tx: "AAAA" }))).status).toBe(400);
    expect(cosignAndSend).not.toHaveBeenCalled();
  });

  it("answers 503 when no sponsor key is configured", async () => {
    sponsor = null;
    expect((await POST(req({ action: "subscribe", tx: "AAAA" }))).status).toBe(503);
  });

  it("rate-limits one IP", async () => {
    cosignAndSend.mockResolvedValue("5sig");
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await POST(req({ action: "subscribe", tx: "AAAA" }, "6.6.6.6"))).status);
    expect(statuses.at(-1)).toBe(429);
  });
});
