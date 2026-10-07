import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { parseArrangerEmails, resolveSession, signInWithToken, type PrivyPort } from "../src/lib/auth/session";
import { platformSettings, userRoles, users, wallets } from "../src/lib/db/schema";
import { testDb } from "./helpers/db";

type Entry = { did: string; email: string | null; wallets?: string[]; expiresAt?: number };
function fakePrivy(tokens: Record<string, Entry>): PrivyPort & { profileCalls: number } {
  const port = {
    profileCalls: 0,
    async verify(token: string) {
      const e = tokens[token];
      if (!e) throw new Error("invalid token");
      return { did: e.did, expiresAt: e.expiresAt ?? 4_000_000_000 };
    },
    async profile(did: string) {
      port.profileCalls++;
      const e = Object.values(tokens).find((x) => x.did === did);
      return { email: e?.email ?? null, solanaWallets: e?.wallets ?? [] };
    },
  };
  return port;
}

const W1 = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

describe("signInWithToken", () => {
  it("creates the user with a normalized email and bootstraps an arranger from ARRANGER_EMAILS", async () => {
    const db = await testDb();
    const privy = fakePrivy({ t1: { did: "did:privy:a", email: " Ops@Example.com " } });
    const { user, expiresAt } = await signInWithToken(db, privy, "t1", parseArrangerEmails(" ops@example.com ,x@example.com"));
    expect(user.email).toBe("ops@example.com");
    expect(user.roles).toEqual(["arranger"]);
    expect(expiresAt).toBe(4_000_000_000);
  });

  it("gives no role to an email outside ARRANGER_EMAILS", async () => {
    const db = await testDb();
    const { user } = await signInWithToken(db, fakePrivy({ t: { did: "did:privy:b", email: "farmer@example.com" } }), "t", ["ops@example.com"]);
    expect(user.roles).toEqual([]);
  });

  it("recovers the arranger role on the next sign-in of a listed address that signed in before it was listed", async () => {
    const db = await testDb();
    const privy = fakePrivy({ t: { did: "did:privy:c", email: "ops@example.com" } });
    const { user } = await signInWithToken(db, privy, "t", []);
    expect(user.roles).toEqual([]);
    const again = await signInWithToken(db, privy, "t", ["ops@example.com"]);
    expect(again.user.roles).toEqual(["arranger"]);
    expect((await signInWithToken(db, privy, "t", ["ops@example.com"])).user.roles).toEqual(["arranger"]);
  });

  it("refuses dev identities when the database is marked production, in the app and in the database itself", async () => {
    const db = await testDb();
    const dev = fakePrivy({ "dev:x@example.com": { did: "did:dev:x@example.com", email: "x@example.com" } });
    await db.insert(platformSettings).values({ key: "environment", value: "production" });
    await expect(signInWithToken(db, dev, "dev:x@example.com", [])).rejects.toMatchObject({ status: 403 });
    await expect(db.insert(users).values({ email: "y@example.com", privyDid: "did:dev:y@example.com" })).rejects.toThrow();
    // Real Privy identities still sign in.
    const real = fakePrivy({ t: { did: "did:privy:z", email: "z@example.com" } });
    expect((await signInWithToken(db, real, "t", [])).user.email).toBe("z@example.com");
  });

  it("attaches a user pre-created by email (role granted before first sign-in) to the Privy DID", async () => {
    const db = await testDb();
    const [pre] = await db.insert(users).values({ email: "inv@example.com" }).returning();
    await db.insert(userRoles).values({ userId: pre!.id, role: "investor" });
    const { user } = await signInWithToken(db, fakePrivy({ t: { did: "did:privy:d", email: "INV@example.com" } }), "t", []);
    expect(user.id).toBe(pre!.id);
    expect(user.roles).toEqual(["investor"]);
  });

  it("records the Privy embedded Solana wallet and stops asking Privy once it is known", async () => {
    const db = await testDb();
    const privy = fakePrivy({ t: { did: "did:privy:e", email: "f@example.com", wallets: [W1] } });
    await signInWithToken(db, privy, "t", []);
    await signInWithToken(db, privy, "t", []);
    const rows = await db.select().from(wallets);
    expect(rows.map((r) => [r.address, r.kind])).toEqual([[W1, "privy-embedded"]]);
    expect(privy.profileCalls).toBe(1);
  });

  it("refuses an invalid token with 401 and an account without email with 403", async () => {
    const db = await testDb();
    await expect(signInWithToken(db, fakePrivy({}), "bad", [])).rejects.toMatchObject({ status: 401 });
    await expect(signInWithToken(db, fakePrivy({ t: { did: "did:privy:f", email: null } }), "t", [])).rejects.toMatchObject({ status: 403 });
  });
});

describe("resolveSession", () => {
  it("returns null without a token, for a rejected token and for an unknown DID", async () => {
    const db = await testDb();
    const privy = fakePrivy({ ok: { did: "did:privy:none", email: "x@example.com" } });
    expect(await resolveSession(db, privy, undefined)).toBeNull();
    expect(await resolveSession(db, privy, "forged")).toBeNull();
    expect(await resolveSession(db, privy, "ok")).toBeNull();
  });

  it("reads roles from Postgres on every call, so a revocation applies to the next request", async () => {
    const db = await testDb();
    const privy = fakePrivy({ t: { did: "did:privy:g", email: "ops@example.com" } });
    const { user } = await signInWithToken(db, privy, "t", ["ops@example.com"]);
    expect((await resolveSession(db, privy, "t"))?.roles).toEqual(["arranger"]);
    await db.delete(userRoles).where(eq(userRoles.userId, user.id));
    expect((await resolveSession(db, privy, "t"))?.roles).toEqual([]);
  });

  it("returns null for an expired token (the verifier rejects it)", async () => {
    const db = await testDb();
    const privy = fakePrivy({ t: { did: "did:privy:h", email: "a@example.com" } });
    await signInWithToken(db, privy, "t", []);
    const expired: PrivyPort = { ...privy, verify: async () => { throw new Error("exp claim timestamp check failed"); } };
    expect(await resolveSession(db, expired, "t")).toBeNull();
  });
});

