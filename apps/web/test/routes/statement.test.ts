import { describe, expect, it, vi } from "vitest";
import { RequestError } from "../../src/lib/errors";

let user: unknown = null;
vi.mock("@/lib/server/auth", async () => (await import("../helpers/auth-mock")).guardsFor(() => user as never));
vi.mock("@/lib/server/db", () => ({ getDb: async () => ({}) }));
vi.mock("@/lib/server/investor-data", () => ({
  investorPortfolio: async (_db: unknown, u: { id: string }) => ({
    positions: [{ poolId: "7", symbol: "DWHT27", wallet: "W", tokens: "2", holding: "200000000000", accrued: null, atMaturity: "212000000000", maturityTs: 1, settlement: "", grainClaimKg: null, action: "View pool" }],
    history: [{ id: "h1", at: new Date("2026-10-05T10:00:00Z"), label: "Subscribed", pool: "DWHT27", amount: "200000000000", tokens: "2", signature: `sig-${u.id}` }],
  }),
}));
const route = await import("../../src/app/api/investor/statement/route");

describe("GET /api/investor/statement", () => {
  it("needs an investor session", async () => {
    user = null;
    expect((await route.GET()).status).toBe(401);
  });

  it("returns the signed-in investor's CSV as an attachment, never cached", async () => {
    user = { id: "u1", email: "a@example.com", roles: ["investor"] };
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="f2f-statement-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const csv = await res.text();
    expect(csv).toContain("2026-10-05,Subscribed,DWHT27,200000.00,2,sig-u1");
    expect(csv).toContain("Holding");
  });
});
