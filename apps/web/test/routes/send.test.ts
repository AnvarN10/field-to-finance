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
  getReader: () => ({ listPools: async () => [{ address: "P1", issuer: "Farmer1" }] }),
}));
vi.mock("@/lib/chain/sponsor", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/chain/sponsor")>()),
  cosignAndSend: (...a: unknown[]) => cosignAndSend(...a),
}));
const recordTx = vi.fn(async () => {});
vi.mock("@/lib/server/tx-history", () => ({ recordUserTx: (...a: unknown[]) => recordTx(...(a as [])) }));
const gate = vi.fn(async (): Promise<string | null> => null);
let dbDown = false;
vi.mock("@/lib/server/db", () => ({ getDb: async () => { if (dbDown) throw new Error("down"); return {}; } }));
let session: { id: string } | null = null;
vi.mock("@/lib/server/auth", () => ({ currentUser: async () => session }));
vi.mock("@/lib/workflow/investor", () => ({ kfdGate: (...a: unknown[]) => gate(...(a as [])) }));
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

  it("signs farmer settlement only for the pool's issuer of record", async () => {
    const run = async (signer: string) => {
      let refused: unknown = null;
      cosignAndSend.mockImplementation(async (deps: { beforeSign?: (i: unknown) => Promise<void> }) => {
        try {
          await deps.beforeSign?.({ signer: { toBase58: () => signer }, summary: { pool: "P1", project: null, amount: null } });
        } catch (e) {
          refused = e;
          throw e;
        }
        return "5sig";
      });
      const r = await POST(req({ action: "elect-settlement", tx: "AAAA" }, `7.7.7.${signer.length}`));
      return { status: r.status, refused };
    };
    expect((await run("Farmer1")).status).toBe(200);
    const other = await run("Stranger");
    expect(other.status).toBe(403);
    expect(other.refused).toBeTruthy();
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

  describe("KFD gate before the sponsor signs a subscribe", () => {
    type Deps = { beforeSign?: (i: unknown) => Promise<void> };
    const info = { signer: { toBase58: () => "W9" }, summary: { pool: "P9", project: null, amount: "1" } };
    const runGate = () =>
      cosignAndSend.mockImplementation(async (deps: Deps) => {
        await deps.beforeSign?.(info);
        return "5sig";
      });

    it("refuses a wallet without the KFD acceptance with 403", async () => {
      gate.mockResolvedValueOnce("kfd");
      runGate();
      const r = await POST(req({ action: "subscribe", tx: "AAAA" }, "7.7.7.1"));
      expect(r.status).toBe(403);
      expect(gate).toHaveBeenCalledWith({}, "W9", "P9", null);
    });

    it("checks the wallet against the signed-in account and refuses another account's wallet", async () => {
      session = { id: "u-new" };
      gate.mockResolvedValueOnce("other_account");
      runGate();
      try {
        const r = await POST(req({ action: "subscribe", tx: "AAAA" }, "7.7.7.4"));
        expect(r.status).toBe(403);
        expect((await r.json()).error.detail).toMatch(/linked to another account/);
        expect(gate).toHaveBeenLastCalledWith({}, "W9", "P9", "u-new");
      } finally {
        session = null;
      }
    });

    it("fails closed with 503 when Postgres is down", async () => {
      dbDown = true;
      runGate();
      try {
        expect((await POST(req({ action: "subscribe", tx: "AAAA" }, "7.7.7.2"))).status).toBe(503);
      } finally {
        dbDown = false;
      }
    });

    it("does not gate refunds", async () => {
      runGate();
      gate.mockClear();
      expect((await POST(req({ action: "refund", tx: "AAAA" }, "7.7.7.3"))).status).toBe(200);
      expect(gate).not.toHaveBeenCalled();
    });
  });
});
