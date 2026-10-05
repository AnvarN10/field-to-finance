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

describe("requireActionRole", () => {
  it("refuses an expired or forged cookie with 401 and asks to sign in again", async () => {
    cookie = "stale";
    await expect(auth.requireActionRole("arranger")).rejects.toMatchObject({ status: 401, message: "Your session expired. Sign in again." });
    cookie = undefined;
    await expect(auth.requireActionRole("arranger")).rejects.toMatchObject({ status: 401 });
  });

  it("refuses a user without the role with 403", async () => {
    cookie = "inv";
    await expect(auth.requireActionRole("arranger")).rejects.toMatchObject({ status: 403, message: "Your account does not have the arranger role." });
  });

  it("returns the user with the role", async () => {
    cookie = "ops";
    expect((await auth.requireActionRole("arranger")).email).toBe("ops@example.com");
  });
});

describe("requireRole", () => {
  it("redirects a signed-out visitor to sign-in with the page to return to", async () => {
    cookie = undefined;
    await expect(auth.requireRole("arranger", "/arranger/roles")).rejects.toThrow("NEXT_REDIRECT /sign-in?next=%2Farranger%2Froles");
  });

  it("returns a forbidden marker instead of redirecting when the role is missing", async () => {
    cookie = "inv";
    expect(await auth.requireRole("arranger", "/arranger")).toMatchObject({ forbidden: true, user: { email: "inv@example.com" } });
  });

  it("returns the user when the role is held", async () => {
    cookie = "ops";
    expect(await auth.requireRole("arranger", "/arranger")).toMatchObject({ forbidden: false, user: { email: "ops@example.com" } });
  });
});

describe("requireServiceAction", () => {
  it("lets an arranger act for a service role and marks it", async () => {
    cookie = "ops";
    expect(await auth.requireServiceAction("compliance")).toMatchObject({ role: "compliance", viaArranger: true, user: { email: "ops@example.com" } });
  });

  it("refuses a user without the service role and asks a signed-out caller to sign in", async () => {
    cookie = "inv";
    await expect(auth.requireServiceAction("scas")).rejects.toMatchObject({ status: 403, message: "Your account does not have the scas role." });
    cookie = undefined;
    await expect(auth.requireServiceAction("scas")).rejects.toMatchObject({ status: 401 });
  });
});

describe("requireAnyRole", () => {
  it("returns the service roles the user may act as on a page; an arranger gets all of them", async () => {
    cookie = "ops";
    expect(await auth.requireAnyRole(["elevator", "lab"], "/elevator")).toMatchObject({ forbidden: false, roles: ["elevator", "lab"] });
    cookie = "inv";
    expect(await auth.requireAnyRole(["elevator", "lab"], "/elevator")).toMatchObject({ forbidden: true, roles: [] });
  });
});
