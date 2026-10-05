import { describe, expect, it, vi } from "vitest";
import type { PrivyPort } from "../../src/lib/auth/session";
import { testDb } from "../helpers/db";

const db = await testDb();
const privy: PrivyPort = {
  async verify(token) {
    if (token !== "good") throw new Error("invalid");
    return { did: "did:privy:route", expiresAt: 4_000_000_000 };
  },
  async profile() {
    return { email: "ops@example.com", solanaWallets: [] };
  },
};
let dbDown = false;
vi.mock("@/lib/server/db", () => ({
  getDb: async () => {
    if (dbDown) throw new Error("connect ECONNREFUSED");
    return db;
  },
}));
vi.mock("@/lib/server/privy", () => ({ getPrivy: () => privy }));
vi.mock("@/lib/server/env", () => ({ serverEnv: () => ({ ARRANGER_EMAILS: "ops@example.com" }) }));
const route = await import("../../src/app/api/session/route");

const post = (body: unknown) => route.POST(new Request("http://x/api/session", { method: "POST", body: JSON.stringify(body) }));

describe("/api/session", () => {
  it("sets an httpOnly SameSite=Lax cookie that ends with the token and returns the roles", async () => {
    const res = await post({ token: "good" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, roles: ["arranger"] });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^f2f_session=good;/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Expires=/i);
  });

  it("answers 401 and sets no cookie for a token Privy rejects", async () => {
    const res = await post({ token: "forged" });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("answers 400 for a missing token", async () => {
    expect((await post({})).status).toBe(400);
  });

  it("answers 503 when Postgres is unavailable", async () => {
    dbDown = true;
    try {
      const res = await post({ token: "good" });
      expect(res.status).toBe(503);
      expect((await res.json()).error).toBe("Accounts are unavailable right now. Try again in a minute.");
    } finally {
      dbDown = false;
    }
  });

  it("DELETE clears the cookie", async () => {
    const res = await route.DELETE();
    expect(res.headers.get("set-cookie") ?? "").toMatch(/f2f_session=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
  });
});
