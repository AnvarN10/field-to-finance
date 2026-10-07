import { describe, expect, it, vi } from "vitest";
import { RequestError } from "../../src/lib/errors";

let actor: unknown = null;
vi.mock("@/lib/server/auth", async () => (await import("../helpers/auth-mock")).guardsFor(() => actor as never));
vi.mock("@/lib/server/db", () => ({ getDb: async () => ({}) }));
vi.mock("@/lib/server/regulator-data", () => ({
  regulatorData: async () => ({
    registry: [{ poolId: "9", symbol: "DWHT27", status: "Funded", issuerWallet: "W", issuerLegalName: "Demo Farm LLP", issuerBin: "000000000000", raised: "1000000", target: "1000000", couponBps: 1200, settlementMode: "Hybrid", maturityTs: 1_800_000_000, holders: 1 }],
    holders: [{ poolId: "9", wallet: "H", balance: "1000000", category: "retail", iin: "000000000001" }],
  }),
  regulatorEvents: async () => [{ at: "2026-10-05T10:00:00.000Z", action: "tx.subscribe", actingRole: null, targetType: "wallet", targetId: "H", signature: "sig", detail: "amount=1000000; pool=P" }],
}));
const route = await import("../../src/app/api/regulator/export/route");
const get = (q: string) => route.GET(new Request(`http://x/api/regulator/export?${q}`));

describe("GET /api/regulator/export", () => {
  it("refuses a signed-out caller and an investor", async () => {
    expect((await get("kind=registry")).status).toBe(401);
    actor = { id: "i", email: "i@example.com", roles: ["investor"] };
    expect((await get("kind=registry")).status).toBe(403);
  });

  it("serves registry, holders and events CSV to the regulator, never cached", async () => {
    actor = { id: "r", email: "r@example.com", roles: ["regulator"] };
    const reg = await get("kind=registry");
    expect(reg.status).toBe(200);
    expect(reg.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(reg.headers.get("cache-control")).toBe("private, no-store");
    expect(reg.headers.get("content-disposition")).toMatch(/^attachment; filename="f2f-registry-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(await reg.text()).toMatch(/^Pool,Symbol,Status,Issuer wallet,Issuer legal name,Issuer BIN/);
    const holders = await (await get("kind=holders")).text();
    expect(holders.split("\r\n")[0]).toBe("Pool,Wallet,Balance (USD),Category,IIN");
    expect(await (await get("kind=events")).text()).toContain("tx.subscribe");
  });

  it("serves an arranger too and rejects an unknown kind", async () => {
    actor = { id: "a", email: "a@example.com", roles: ["arranger"] };
    expect((await get("kind=registry")).status).toBe(200);
    expect((await get("kind=emails")).status).toBe(400);
  });
});
