import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivyPort } from "../src/lib/auth/session";
import { userRoles, users } from "../src/lib/db/schema";
import { testDb } from "./helpers/db";

const db = await testDb();
const [arranger] = await db.insert(users).values({ email: "ops@example.com", privyDid: "did:privy:ops" }).returning();
await db.insert(userRoles).values({ userId: arranger!.id, role: "arranger" });
await db.insert(users).values({ email: "inv@example.com", privyDid: "did:privy:inv" });

const privy: PrivyPort = {
  async verify(token) {
    if (token === "ops") return { did: "did:privy:ops", expiresAt: 4_000_000_000 };
    if (token === "inv") return { did: "did:privy:inv", expiresAt: 4_000_000_000 };
    throw new Error("expired");
  },
  async profile() {
    return { email: null, solanaWallets: [] };
  },
};
let cookie: string | undefined;
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookie ? { value: cookie } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/privy", () => ({ getPrivy: () => privy }));
const auth = await import("../src/lib/server/auth");

beforeEach(() => {
  redirect.mockClear();
});

describe("requirePermission", () => {
  it("refuses an expired or forged cookie with 401 and asks to sign in again", async () => {
    cookie = "stale";
    await expect(auth.requirePermission("audit.view")).rejects.toMatchObject({ status: 401, message: "Your session expired. Sign in again." });
    cookie = undefined;
    await expect(auth.requirePermission("audit.view")).rejects.toMatchObject({ status: 401 });
  });

  it("refuses a user without the permission with 403", async () => {
    cookie = "inv";
    await expect(auth.requirePermission("audit.view")).rejects.toMatchObject({ status: 403, message: "You do not have permission to view the audit log." });
  });

  it("returns the actor with the acting role", async () => {
    cookie = "ops";
    expect(await auth.requirePermission("kyc.decide")).toMatchObject({ actingRole: "arranger", user: { email: "ops@example.com" } });
  });
});

describe("requireAccount", () => {
  it("refuses a user without the account kind and a signed-out caller", async () => {
    cookie = "ops";
    await expect(auth.requireAccount("investor")).rejects.toMatchObject({ status: 403, message: "This needs an investor account." });
    cookie = undefined;
    await expect(auth.requireAccount("investor")).rejects.toMatchObject({ status: 401 });
  });
});


